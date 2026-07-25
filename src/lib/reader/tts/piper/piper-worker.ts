// Web Worker that owns the Piper synthesis core (onnxruntime-web + espeak-ng +
// the loaded voice model). Running here keeps the heavy WASM inference off the
// UI thread and lets the model stay warm across sentences.
//
// It processes requests strictly in order through a single queue: onnxruntime
// session.run() and setVoice must not overlap, and the service only relies on
// FIFO ordering (configure -> setVoice -> synthesize...).

import {
  configure,
  setVoice,
  synthesizeSentence,
  getSampleRate,
} from "./piper-core";
import type { PiperRequest, PiperResponse } from "./piper-messages";

const ctx = self as unknown as Worker;

// Serialize all jobs: each incoming request is appended to a promise chain so
// exactly one runs at a time.
let queue: Promise<void> = Promise.resolve();

function post(response: PiperResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(response, transfer);
}

async function handle(msg: PiperRequest): Promise<void> {
  try {
    switch (msg.type) {
      case "configure": {
        await configure({
          wasmBase: msg.wasmBase,
          espeakBase: msg.espeakBase,
          numThreads: msg.numThreads,
        });
        post({ reqId: msg.reqId, ok: true });
        return;
      }
      case "setVoice": {
        const sampleRate = await setVoice(msg.config, msg.modelBytes);
        post({ reqId: msg.reqId, ok: true, sampleRate });
        return;
      }
      case "synthesize": {
        const pcm = await synthesizeSentence(msg.text, {
          speakerId: msg.speakerId,
          lengthScale: msg.lengthScale,
          noiseScale: msg.noiseScale,
          noiseWScale: msg.noiseWScale,
        });
        post({ reqId: msg.reqId, ok: true, pcm, sampleRate: getSampleRate() }, [
          pcm.buffer,
        ]);
        return;
      }
    }
  } catch (e) {
    post({
      reqId: (msg as { reqId: number }).reqId,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

ctx.onmessage = (event: MessageEvent<PiperRequest>) => {
  const msg = event.data;
  queue = queue.then(() => handle(msg));
};

import { describe, expect, it, vi } from "vitest";
import { PiperTtsService, type PiperWorkerLike } from "./piper-tts-service";
import type { PiperRequest, PiperResponse } from "./piper-messages";
import { TtsServiceError } from "../tts-service";

// A controllable fake of the Piper worker. By default it answers every request
// successfully (configure -> ok, setVoice -> sampleRate, synthesize -> PCM). A
// custom `respond` can override behavior (errors, delays, silence).
class FakeWorker implements PiperWorkerLike {
  posted: PiperRequest[] = [];
  #listeners = new Map<string, Array<(e: MessageEvent & ErrorEvent) => void>>();
  respond: (
    msg: PiperRequest,
  ) => PiperResponse | null | Promise<PiperResponse | null>;
  terminated = false;

  constructor(
    respond?: (
      msg: PiperRequest,
    ) => PiperResponse | null | Promise<PiperResponse | null>,
  ) {
    this.respond = respond ?? FakeWorker.defaultRespond;
  }

  static defaultRespond(msg: PiperRequest): PiperResponse {
    switch (msg.type) {
      case "configure":
        return { reqId: msg.reqId, ok: true };
      case "setVoice":
        return { reqId: msg.reqId, ok: true, sampleRate: 22050 };
      case "synthesize":
        return {
          reqId: msg.reqId,
          ok: true,
          pcm: new Float32Array([0, 0.5, -0.5, 0]),
          sampleRate: 22050,
        };
    }
  }

  postMessage(message: unknown): void {
    const msg = message as PiperRequest;
    this.posted.push(msg);
    void Promise.resolve(this.respond(msg)).then((res) => {
      if (res)
        this.#emit("message", { data: res } as MessageEvent & ErrorEvent);
    });
  }

  addEventListener(
    type: string,
    listener: (e: MessageEvent & ErrorEvent) => void,
  ): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  removeEventListener(
    type: string,
    listener: (e: MessageEvent & ErrorEvent) => void,
  ): void {
    const list = this.#listeners.get(type);
    if (list)
      this.#listeners.set(
        type,
        list.filter((l) => l !== listener),
      );
  }

  terminate(): void {
    this.terminated = true;
  }

  #emit(type: string, event: MessageEvent & ErrorEvent): void {
    for (const l of this.#listeners.get(type) ?? []) l(event);
  }
}

const VOICE_LIST = [
  {
    id: "cs_CZ-jirka-medium",
    name: "Jirka",
    lang: "cs",
    quality: "medium",
    num_speakers: 1,
  },
  {
    id: "en_US-lessac-high",
    name: "Lessac",
    lang: "en-US",
    quality: "high",
    num_speakers: 1,
  },
];

const VOICE_CONFIG = { audio: { sample_rate: 22050 }, phoneme_type: "espeak" };

// A fetch that serves the voice list, the voice config, and the model bytes.
function makeFetch(overrides?: { list?: () => Response | Promise<Response> }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/tts/piper/voices/")) {
      if (url.endsWith(".onnx.json")) {
        return new Response(JSON.stringify(VOICE_CONFIG), { status: 200 });
      }
      if (url.endsWith(".onnx")) {
        return new Response(new ArrayBuffer(8), { status: 200 });
      }
    }
    if (url.includes("/tts/piper/voices")) {
      return overrides?.list
        ? overrides.list()
        : new Response(JSON.stringify(VOICE_LIST), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

function makeService(opts?: {
  worker?: FakeWorker;
  fetch?: typeof fetch;
  lengthScale?: number;
}) {
  const worker = opts?.worker ?? new FakeWorker();
  const service = new PiperTtsService({
    baseUrl: "http://mbs4.test",
    fetch: opts?.fetch ?? makeFetch(),
    lengthScale: opts?.lengthScale,
    createWorker: () => worker,
  });
  return { service, worker };
}

describe("PiperTtsService.listVoices", () => {
  it("maps entries and filters by language", async () => {
    const { service } = makeService();
    const cs = await service.listVoices("cs");
    expect(cs).toEqual([
      {
        id: "cs_CZ-jirka-medium",
        name: "Jirka",
        lang: "cs",
        description: "medium",
      },
    ]);
    const all = await service.listVoices();
    expect(all.map((v) => v.id)).toEqual([
      "cs_CZ-jirka-medium",
      "en_US-lessac-high",
    ]);
  });

  it("wraps network failure as a retryable TtsServiceError", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const { service } = makeService({ fetch: fetchFn });
    await expect(service.listVoices()).rejects.toMatchObject({
      name: "TtsServiceError",
      retryable: true,
    });
  });

  it("treats a 503 as retryable", async () => {
    const { service } = makeService({
      fetch: makeFetch({ list: () => new Response("nope", { status: 503 }) }),
    });
    await expect(service.listVoices()).rejects.toMatchObject({
      retryable: true,
    });
  });
});

describe("PiperTtsService.synthesize", () => {
  it("loads the voice then returns WAV audio", async () => {
    const { service, worker } = makeService();
    await service.listVoices();
    const result = await service.synthesize({
      text: "Ahoj",
      voice: "cs_CZ-jirka-medium",
    });
    expect(result.mimeType).toBe("audio/wav");
    // WAV container starts with the RIFF magic.
    const header = new TextDecoder().decode(new Uint8Array(result.data, 0, 4));
    expect(header).toBe("RIFF");
    // configure, then setVoice, then synthesize.
    expect(worker.posted.map((m) => m.type)).toEqual([
      "configure",
      "setVoice",
      "synthesize",
    ]);
  });

  it("maps rate to an inverse length scale", async () => {
    const { service, worker } = makeService({ lengthScale: 1.0 });
    await service.listVoices();
    await service.synthesize({
      text: "Ahoj",
      voice: "cs_CZ-jirka-medium",
      rate: 2,
    });
    const synth = worker.posted.find((m) => m.type === "synthesize");
    expect(synth).toBeDefined();
    expect((synth as { lengthScale: number }).lengthScale).toBeCloseTo(0.5);
  });

  it("only loads the model once across sentences", async () => {
    const { service, worker } = makeService();
    await service.listVoices();
    await service.synthesize({ text: "One", voice: "cs_CZ-jirka-medium" });
    await service.synthesize({ text: "Two", voice: "cs_CZ-jirka-medium" });
    expect(worker.posted.filter((m) => m.type === "setVoice")).toHaveLength(1);
    expect(worker.posted.filter((m) => m.type === "synthesize")).toHaveLength(
      2,
    );
  });

  it("rejects with the abort reason when the signal is already aborted", async () => {
    const { service } = makeService();
    await service.listVoices();
    const reason = new DOMException("stop", "AbortError");
    await expect(
      service.synthesize(
        { text: "Ahoj", voice: "cs_CZ-jirka-medium" },
        AbortSignal.abort(reason),
      ),
    ).rejects.toBe(reason);
  });

  it("surfaces a worker synthesis error as a non-retryable TtsServiceError", async () => {
    const worker = new FakeWorker((msg) =>
      msg.type === "synthesize"
        ? { reqId: msg.reqId, ok: false, error: "kernel exploded" }
        : FakeWorker.defaultRespond(msg),
    );
    const { service } = makeService({ worker });
    await service.listVoices();
    await expect(
      service.synthesize({ text: "Ahoj", voice: "cs_CZ-jirka-medium" }),
    ).rejects.toMatchObject({ name: "TtsServiceError", retryable: false });
  });

  it("errors when no voice is selected and none are known", async () => {
    const { service } = makeService();
    await expect(service.synthesize({ text: "Ahoj" })).rejects.toMatchObject({
      name: "TtsServiceError",
      retryable: false,
    });
  });
});

describe("PiperTtsService lifecycle", () => {
  it("preload warms the model without a synthesize", async () => {
    const { service, worker } = makeService();
    await service.listVoices();
    service.preload("cs_CZ-jirka-medium");
    // let the async load settle
    await vi.waitFor(() =>
      expect(worker.posted.some((m) => m.type === "setVoice")).toBe(true),
    );
    expect(worker.posted.some((m) => m.type === "synthesize")).toBe(false);
  });

  it("destroy terminates the worker", async () => {
    const { service, worker } = makeService();
    await service.listVoices();
    await service.synthesize({ text: "Ahoj", voice: "cs_CZ-jirka-medium" });
    service.destroy();
    expect(worker.terminated).toBe(true);
  });
});

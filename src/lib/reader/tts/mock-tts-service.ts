// Mock TTS service for development and tests: synthesizes a gently modulated
// tone whose duration is proportional to the text length, encoded as WAV.
// Uses no audio APIs, so it also runs in happy-dom unit tests.

import {
  TtsServiceError,
  type SynthesisRequest,
  type SynthesisResult,
  type TtsService,
  type Voice,
} from "./tts-service";

const SAMPLE_RATE = 22050;
const SECONDS_PER_WORD = 0.3;
const MIN_DURATION_S = 0.5;
const MAX_DURATION_S = 15;

const VOICES: Voice[] = [
  { name: "Mock Low", lang: "en", description: "Low mock tone" },
  { name: "Mock High", lang: "en", description: "High mock tone" },
  { name: "Mock Bell", lang: "cs", description: "Bell-like mock tone" },
];

// deterministic small hash for per-voice/per-text variation
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function encodeWavPcm16(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return buffer;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class MockTtsService implements TtsService {
  readonly id = "mock";
  #latencyMs: number;
  #failEveryNth: number;
  #calls = 0;

  // latencyMs simulates service response time; failEveryNth > 0 makes every
  // Nth synthesize call fail with a retryable error (outage simulation)
  constructor(opts?: { latencyMs?: number; failEveryNth?: number }) {
    this.#latencyMs = opts?.latencyMs ?? 50;
    this.#failEveryNth = opts?.failEveryNth ?? 0;
  }

  async listVoices(): Promise<Voice[]> {
    await delay(this.#latencyMs);
    return VOICES.map((v) => ({ ...v }));
  }

  async synthesize(
    req: SynthesisRequest,
    signal?: AbortSignal,
  ): Promise<SynthesisResult> {
    this.#calls++;
    await delay(this.#latencyMs, signal);
    if (this.#failEveryNth > 0 && this.#calls % this.#failEveryNth === 0) {
      throw new TtsServiceError("Mock TTS service unavailable", {
        retryable: true,
      });
    }
    const words = req.text.split(/\s+/).filter(Boolean).length;
    const duration = Math.min(
      MAX_DURATION_S,
      Math.max(MIN_DURATION_S, words * SECONDS_PER_WORD),
    );
    // base pitch per voice, slight variation per sentence
    const base = 160 + (hash(req.voice ?? VOICES[0].name) % 5) * 60;
    const freq = base + (hash(req.text) % 40);
    const count = Math.round(duration * SAMPLE_RATE);
    const samples = new Float32Array(count);
    const fade = Math.min(0.03 * SAMPLE_RATE, count / 4);
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE;
      // amplitude modulation makes sentence boundaries audible
      const am = 0.7 + 0.3 * Math.sin(2 * Math.PI * 2.5 * t);
      let v = 0.25 * am * Math.sin(2 * Math.PI * freq * t);
      if (i < fade) v *= i / fade;
      if (count - i < fade) v *= (count - i) / fade;
      samples[i] = v;
    }
    return { data: encodeWavPcm16(samples, SAMPLE_RATE), mimeType: "audio/wav" };
  }
}

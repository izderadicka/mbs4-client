// Browser-side Piper TTS provider. Synthesizes speech locally with Piper neural
// voices (ONNX) + espeak-ng phonemization, running the heavy WASM work in a
// dedicated Web Worker (piper-worker.ts). Voice models and their configs are
// served by the mbs4 server; the app static assets (ORT/espeak WASM) are served
// same-origin.
//
// Returns WAV audio from synthesize(), so it uses the standard
// TtsServicePipeline (buffering/prefetch/retry) like the edge and mock
// providers. The model is downloaded and initialized ahead of playback via
// preload(), invoked by the controller as soon as a voice is chosen.

import {
  PIPER_DEFAULT_LENGTH_SCALE,
  PIPER_DEFAULT_NOISE_SCALE,
  PIPER_DEFAULT_NOISE_W_SCALE,
  PIPER_ESPEAK_BASE,
  PIPER_VOICES_PATH,
  PIPER_WASM_BASE,
} from "$lib/config";
import {
  TtsServicePipeline,
  type PipelineEvent,
  type SpeechPipeline,
} from "../pipeline";
import { encodeWavPcm16 } from "../mock-tts-service";
import {
  matchesLanguage,
  TtsServiceError,
  type SynthesisRequest,
  type SynthesisResult,
  type TtsService,
  type Voice,
} from "../tts-service";
import type { PiperVoiceConfig } from "./piper-core";
import type {
  PiperOkResponse,
  PiperRequest,
  PiperRequestBody,
  PiperResponse,
} from "./piper-messages";

// One entry of the voice-list endpoint (contract with the mbs4 server, which
// derives it by scanning the .onnx.json files). `model` is the file base name
// (files: {model}.onnx and {model}.onnx.json); `speaker` selects a speaker for
// multi-speaker models. When `model`/`speaker` are omitted, `id` is the model
// and speaker 0 is used.
interface PiperVoiceListEntry {
  id: string;
  name?: string;
  language?: string;
  model?: string;
  speaker?: number;
  quality?: string;
}

// Minimal structural view of a Worker so the service can be unit-tested with a
// fake (the real Worker satisfies this).
export interface PiperWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: string,
    listener: (event: MessageEvent & ErrorEvent) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent & ErrorEvent) => void,
  ): void;
  terminate(): void;
}

export interface PiperTtsServiceOptions {
  // Base URL of the mbs4 server serving voice files; "" (default) = same origin.
  baseUrl?: string;
  // WASM inference threads; defaults to hardwareConcurrency when the page is
  // cross-origin isolated, else 1 (single-threaded fallback).
  numThreads?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseWScale?: number;
  // Test seams.
  createWorker?: () => PiperWorkerLike;
  fetch?: typeof fetch;
}

function defaultNumThreads(): number {
  const isolated =
    typeof globalThis !== "undefined" &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated ===
      true;
  if (!isolated) return 1;
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 0;
  return Math.max(1, cores || 4);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError");
}

interface Pending {
  resolve: (r: PiperOkResponse) => void;
  reject: (e: unknown) => void;
}

export class PiperTtsService implements TtsService {
  readonly id = "piper";

  #baseUrl: string;
  #numThreads: number;
  #lengthScale: number;
  #noiseScale: number;
  #noiseWScale: number;
  #fetch: typeof fetch;
  #createWorker: () => PiperWorkerLike;

  #worker: PiperWorkerLike | null = null;
  #nextReqId = 1;
  #pending = new Map<number, Pending>();

  // Voice.id -> {model file base name, speaker index}, populated by listVoices.
  #voiceMeta = new Map<string, { model: string; speaker: number }>();

  // The model currently loaded (or loading) in the worker, and its load promise
  // (resolving to the sample rate). Switching voices replaces both.
  #loadModel: string | null = null;
  #loadPromise: Promise<number> | null = null;

  constructor(opts?: PiperTtsServiceOptions) {
    this.#baseUrl = (opts?.baseUrl ?? "").replace(/\/$/, "");
    this.#numThreads = opts?.numThreads ?? defaultNumThreads();
    this.#lengthScale = opts?.lengthScale ?? PIPER_DEFAULT_LENGTH_SCALE;
    this.#noiseScale = opts?.noiseScale ?? PIPER_DEFAULT_NOISE_SCALE;
    this.#noiseWScale = opts?.noiseWScale ?? PIPER_DEFAULT_NOISE_W_SCALE;
    this.#fetch = opts?.fetch ?? globalThis.fetch.bind(globalThis);
    this.#createWorker =
      opts?.createWorker ??
      (() =>
        new Worker(new URL("./piper-worker.ts", import.meta.url), {
          type: "module",
        }) as unknown as PiperWorkerLike);
  }

  createPipeline(onEvent: (e: PipelineEvent) => void): SpeechPipeline {
    return new TtsServicePipeline(this, onEvent);
  }

  async listVoices(language?: string): Promise<Voice[]> {
    const url =
      this.#url(PIPER_VOICES_PATH) +
      (language ? `?language=${encodeURIComponent(language)}` : "");
    let response: Response;
    try {
      response = await this.#fetch(url, { credentials: "include" });
    } catch (e) {
      throw new TtsServiceError("Piper voice service unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!response.ok) {
      throw new TtsServiceError(
        `Piper voice list error (status ${response.status})`,
        { retryable: response.status === 429 || response.status >= 500 },
      );
    }
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new TtsServiceError("Invalid Piper voices response", {
        retryable: false,
      });
    }

    this.#voiceMeta.clear();
    const voices: Voice[] = [];
    for (const entry of data as PiperVoiceListEntry[]) {
      if (!entry || typeof entry.id !== "string") continue;
      const model = typeof entry.model === "string" ? entry.model : entry.id;
      const speaker = typeof entry.speaker === "number" ? entry.speaker : 0;
      this.#voiceMeta.set(entry.id, { model, speaker });
      // The server already filters by language; filter again defensively.
      if (language && !matchesLanguage(entry.language, language)) continue;
      voices.push({
        id: entry.id,
        name: entry.name ?? entry.id,
        lang: entry.language,
        description: entry.quality,
      });
    }
    return voices;
  }

  async synthesize(
    req: SynthesisRequest,
    signal?: AbortSignal,
  ): Promise<SynthesisResult> {
    if (signal?.aborted) throw abortReason(signal);

    const { model, speaker } = this.#resolveVoice(req.voice);
    if (!model) {
      throw new TtsServiceError("No Piper voice selected", {
        retryable: false,
      });
    }

    const sampleRate = await this.#ensureVoice(model);
    if (signal?.aborted) throw abortReason(signal);

    let response: PiperOkResponse;
    try {
      response = await this.#rpc(
        {
          type: "synthesize",
          text: req.text,
          speakerId: speaker,
          lengthScale: this.#lengthScaleFor(req.rate),
          noiseScale: this.#noiseScale,
          noiseWScale: this.#noiseWScale,
        },
        [],
        signal,
      );
    } catch (e) {
      if (signal?.aborted) throw e; // abort reason, propagate untouched
      throw new TtsServiceError("Piper synthesis failed", {
        retryable: false,
        cause: e,
      });
    }

    const pcm = response.pcm ?? new Float32Array(0);
    return {
      data: encodeWavPcm16(pcm, response.sampleRate ?? sampleRate),
      mimeType: "audio/wav",
    };
  }

  // Kick off model download + initialization ahead of playback (idempotent per
  // model). Errors are swallowed here; they resurface on the next synthesize.
  preload(voice?: string): void {
    const { model } = this.#resolveVoice(voice);
    if (!model) return;
    void this.#ensureVoice(model).catch(() => {});
  }

  // Terminate the worker and fail any in-flight requests. Called from the
  // controller when read-aloud is disabled.
  destroy(): void {
    const worker = this.#worker;
    this.#worker = null;
    if (worker) {
      worker.removeEventListener("message", this.#onMessage);
      worker.removeEventListener("error", this.#onWorkerError);
      worker.terminate();
    }
    for (const pending of this.#pending.values()) {
      pending.reject(new DOMException("Aborted", "AbortError"));
    }
    this.#pending.clear();
    this.#loadModel = null;
    this.#loadPromise = null;
  }

  // --- internals ---------------------------------------------------------------

  #url(path: string): string {
    return this.#baseUrl + path;
  }

  // Map a numeric rate (1.0 = normal) to Piper's length scale, which is the
  // inverse of speed (larger = slower).
  #lengthScaleFor(rate?: number): number {
    if (!rate || rate <= 0) return this.#lengthScale;
    return this.#lengthScale / rate;
  }

  #resolveVoice(voiceId?: string): { model: string | null; speaker: number } {
    if (voiceId) {
      const meta = this.#voiceMeta.get(voiceId);
      if (meta) return { model: meta.model, speaker: meta.speaker };
      // Not from a prior listVoices (e.g. a persisted pref) - treat as a model.
      return { model: voiceId, speaker: 0 };
    }
    const first = this.#voiceMeta.values().next().value;
    return first
      ? { model: first.model, speaker: first.speaker }
      : { model: null, speaker: 0 };
  }

  #ensureVoice(model: string): Promise<number> {
    if (this.#loadModel === model && this.#loadPromise) {
      return this.#loadPromise;
    }
    this.#loadModel = model;
    const promise = this.#loadVoice(model).catch((e) => {
      // Allow a later retry to reload this model.
      if (this.#loadModel === model) {
        this.#loadModel = null;
        this.#loadPromise = null;
      }
      throw e;
    });
    this.#loadPromise = promise;
    return promise;
  }

  async #loadVoice(model: string): Promise<number> {
    const enc = encodeURIComponent(model);
    const [config, modelBytes] = await Promise.all([
      this.#fetchJson(`${PIPER_VOICES_PATH}/${enc}.onnx.json`),
      this.#fetchBytes(`${PIPER_VOICES_PATH}/${enc}.onnx`),
    ]);
    let response: PiperOkResponse;
    try {
      response = await this.#rpc(
        { type: "setVoice", config: config as PiperVoiceConfig, modelBytes },
        [modelBytes],
      );
    } catch (e) {
      throw new TtsServiceError("Failed to initialize Piper voice", {
        retryable: false,
        cause: e,
      });
    }
    return (
      response.sampleRate ?? (config as PiperVoiceConfig).audio.sample_rate
    );
  }

  async #fetchJson(path: string): Promise<unknown> {
    const res = await this.#fetchFile(path);
    return res.json();
  }

  async #fetchBytes(path: string): Promise<ArrayBuffer> {
    const res = await this.#fetchFile(path);
    return res.arrayBuffer();
  }

  async #fetchFile(path: string): Promise<Response> {
    let res: Response;
    try {
      res = await this.#fetch(this.#url(path), { credentials: "include" });
    } catch (e) {
      throw new TtsServiceError("Piper voice file unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!res.ok) {
      throw new TtsServiceError(
        `Piper voice file error (status ${res.status})`,
        {
          retryable: res.status === 429 || res.status >= 500,
        },
      );
    }
    return res;
  }

  #ensureWorker(): PiperWorkerLike {
    if (this.#worker) return this.#worker;
    const worker = this.#createWorker();
    worker.addEventListener("message", this.#onMessage);
    worker.addEventListener("error", this.#onWorkerError);
    this.#worker = worker;
    // Configure once; FIFO ordering guarantees this runs before any setVoice.
    void this.#rpc({
      type: "configure",
      wasmBase: PIPER_WASM_BASE,
      espeakBase: PIPER_ESPEAK_BASE,
      numThreads: this.#numThreads,
    }).catch(() => {});
    return worker;
  }

  #onMessage = (event: MessageEvent & ErrorEvent): void => {
    const res = (event as MessageEvent).data as PiperResponse;
    if (!res || typeof res.reqId !== "number") return;
    const pending = this.#pending.get(res.reqId);
    if (!pending) return;
    this.#pending.delete(res.reqId);
    if (res.ok) pending.resolve(res);
    else pending.reject(new Error(res.error));
  };

  #onWorkerError = (event: MessageEvent & ErrorEvent): void => {
    const message = (event as ErrorEvent).message || "Piper worker crashed";
    for (const pending of this.#pending.values()) {
      pending.reject(new Error(message));
    }
    this.#pending.clear();
  };

  // Post a request to the worker and await its correlated response. An optional
  // AbortSignal rejects the promise with the abort reason and stops tracking the
  // response (the worker may still finish; its late reply is ignored).
  #rpc(
    msg: PiperRequestBody,
    transfer: Transferable[] = [],
    signal?: AbortSignal,
  ): Promise<PiperOkResponse> {
    const worker = this.#ensureWorker();
    const reqId = this.#nextReqId++;
    return new Promise<PiperOkResponse>((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortReason(signal));
        return;
      }
      const onAbort = () => {
        this.#pending.delete(reqId);
        reject(abortReason(signal!));
      };
      this.#pending.set(reqId, {
        resolve: (r) => {
          signal?.removeEventListener("abort", onAbort);
          resolve(r);
        },
        reject: (e) => {
          signal?.removeEventListener("abort", onAbort);
          reject(e);
        },
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      worker.postMessage({ ...msg, reqId } as PiperRequest, transfer);
    });
  }
}

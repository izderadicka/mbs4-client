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
import type { VoiceInfo } from "$lib/api";
import { apiClient, ApiClient } from "$lib/api/client";

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
  // API client used to fetch the voice list and voice files from the mbs4
  // server; defaults to the shared singleton.
  api?: ApiClient;
  // WASM inference threads; defaults to hardwareConcurrency when the page is
  // cross-origin isolated, else 1 (single-threaded fallback).
  numThreads?: number;
  lengthScale?: number;
  noiseScale?: number;
  noiseWScale?: number;
  // Test seam.
  createWorker?: () => PiperWorkerLike;
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

  #api: ApiClient;
  #numThreads: number;
  #lengthScale: number;
  #noiseScale: number;
  #noiseWScale: number;
  #createWorker: () => PiperWorkerLike;

  #worker: PiperWorkerLike | null = null;
  #nextReqId = 1;
  #pending = new Map<number, Pending>();

  // Voice ids from the most recent listVoices (post language filter, in order),
  // used to pick a default when synthesize/preload is called without a voice.
  #voiceIds: string[] = [];

  // The model currently loaded (or loading) in the worker, and its load promise
  // (resolving to the sample rate). Switching voices replaces both.
  #loadModel: string | null = null;
  #loadPromise: Promise<number> | null = null;

  constructor(opts?: PiperTtsServiceOptions) {
    this.#api = opts?.api ?? apiClient;
    this.#numThreads = opts?.numThreads ?? defaultNumThreads();
    this.#lengthScale = opts?.lengthScale ?? PIPER_DEFAULT_LENGTH_SCALE;
    this.#noiseScale = opts?.noiseScale ?? PIPER_DEFAULT_NOISE_SCALE;
    this.#noiseWScale = opts?.noiseWScale ?? PIPER_DEFAULT_NOISE_W_SCALE;
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
    let result: Awaited<ReturnType<ApiClient["listPiperVoices"]>>;
    try {
      result = await this.#api.listPiperVoices(language);
    } catch (e) {
      throw new TtsServiceError("Piper voice service unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!result.response.ok) {
      throw new TtsServiceError(
        `Piper voice list error (status ${result.response.status})`,
        {
          retryable:
            result.response.status === 429 || result.response.status >= 500,
        },
      );
    }
    const data = result.data as unknown;
    if (!Array.isArray(data)) {
      throw new TtsServiceError("Invalid Piper voices response", {
        retryable: false,
      });
    }

    this.#voiceIds = [];
    const voices: Voice[] = [];
    // The `id` is the model file base name: {id}.onnx and {id}.onnx.json.
    for (const entry of data as VoiceInfo[]) {
      if (!entry || typeof entry.id !== "string") continue;
      // The server already filters by language; filter again defensively.
      if (language && !matchesLanguage(entry.lang, language)) continue;
      this.#voiceIds.push(entry.id);
      voices.push({
        id: entry.id,
        name: entry.name ?? entry.id,
        lang: entry.lang,
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

    const model = this.#resolveVoice(req.voice);
    if (!model) {
      throw new TtsServiceError("No Piper voice selected", {
        retryable: false,
      });
    }

    const sampleRate = await this.#awaitVoice(model, signal);
    if (signal?.aborted) throw abortReason(signal);

    let response: PiperOkResponse;
    try {
      response = await this.#rpc(
        {
          type: "synthesize",
          text: req.text,
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
    const model = this.#resolveVoice(voice);
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

  // Map a numeric rate (1.0 = normal) to Piper's length scale, which is the
  // inverse of speed (larger = slower).
  #lengthScaleFor(rate?: number): number {
    if (!rate || rate <= 0) return this.#lengthScale;
    return this.#lengthScale / rate;
  }

  // Resolve a requested voice id to the model file base name (id === model).
  // An explicit id is used as-is (a persisted pref may not be in the current
  // list); with no id, fall back to the first listed voice.
  #resolveVoice(voiceId?: string): string | null {
    return voiceId ?? this.#voiceIds[0] ?? null;
  }

  // Wait for the voice to be loaded, but give up as soon as the request is
  // aborted: a model download plus worker init takes seconds, and a stopped
  // request must not stay attached to it (the user pressed stop while the
  // pipeline was buffering). The load itself is shared and keeps running, so
  // a later play reuses it instead of starting over.
  #awaitVoice(model: string, signal?: AbortSignal): Promise<number> {
    const load = this.#ensureVoice(model);
    if (!signal) return load;
    // the racing await below may lose; keep its rejection from going unhandled
    load.catch(() => {});
    return new Promise<number>((resolve, reject) => {
      if (signal.aborted) {
        reject(abortReason(signal));
        return;
      }
      const onAbort = () => reject(abortReason(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      load.then(resolve, reject).finally(() => {
        signal.removeEventListener("abort", onAbort);
      });
    });
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
    const [config, modelBytes] = await Promise.all([
      this.#fetchVoiceFile(() => this.#api.getPiperVoiceConfig(model)),
      this.#fetchVoiceFile(() => this.#api.getPiperVoiceModel(model)),
    ]);
    let response: PiperOkResponse;
    try {
      response = await this.#rpc(
        {
          type: "setVoice",
          config: config as PiperVoiceConfig,
          modelBytes: modelBytes as ArrayBuffer,
        },
        [modelBytes as ArrayBuffer],
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

  // Await an API-client voice-file request and classify failures into the
  // retryable TtsServiceError contract (network -> retryable; 429/5xx ->
  // retryable; other non-ok -> terminal). Returns the parsed body (JSON config
  // or ArrayBuffer model bytes, per the request).
  async #fetchVoiceFile(
    request: () => Promise<{ data?: unknown; response: Response }>,
  ): Promise<unknown> {
    let result: { data?: unknown; response: Response };
    try {
      result = await request();
    } catch (e) {
      throw new TtsServiceError("Piper voice file unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!result.response.ok) {
      throw new TtsServiceError(
        `Piper voice file error (status ${result.response.status})`,
        {
          retryable:
            result.response.status === 429 || result.response.status >= 500,
        },
      );
    }
    return result.data;
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

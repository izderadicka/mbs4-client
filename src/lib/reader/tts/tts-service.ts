// Generic, provider-agnostic interface to a TTS (speech synthesis) service.
// No concrete provider is chosen yet; implementations must satisfy this
// contract so the rest of the read-aloud pipeline never depends on one.

import { TTS_PROVIDER } from "$lib/dev";

export interface Voice {
  // unique identifier of the voice
  name: string;
  // BCP-47 language tag of the voice, e.g. "en-US", "cs"
  lang?: string;
  description?: string;
}

export interface SynthesisRequest {
  text: string;
  // Voice.name; undefined lets the service pick its default. The voice
  // implies the language, so no separate language field is needed.
  voice?: string;
  // 1.0 = normal; implementations may ignore it (playback applies its own
  // rate), but providers that support pitch-preserving rate can use it
  rate?: number;
}

export interface SynthesisResult {
  data: ArrayBuffer;
  // e.g. "audio/wav", "audio/mpeg", "audio/ogg" - anything the browser's
  // decodeAudioData understands
  mimeType: string;
}

export interface TtsService {
  readonly id: string;
  listVoices(): Promise<Voice[]>;
  // Rejects with TtsServiceError on service failure; when `signal` aborts,
  // rejects with the abort reason (DOMException "AbortError"), never with
  // TtsServiceError, so cancellations are not mistaken for outages.
  synthesize(req: SynthesisRequest, signal?: AbortSignal): Promise<SynthesisResult>;
}

export class TtsServiceError extends Error {
  // true for transient failures worth retrying (network, 5xx, 429)
  readonly retryable: boolean;

  constructor(message: string, opts: { retryable: boolean; cause?: unknown }) {
    super(message, { cause: opts.cause });
    this.name = "TtsServiceError";
    this.retryable = opts.retryable;
  }
}

export async function createTtsService(): Promise<TtsService> {
  if (TTS_PROVIDER === "mock") {
    const { MockTtsService } = await import("./mock-tts-service");
    return new MockTtsService();
  }
  const { RestTtsService } = await import("./rest-tts-service");
  return new RestTtsService();
}

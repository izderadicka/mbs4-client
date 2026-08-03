// Generic, provider-agnostic interface to a TTS (speech synthesis) service.
// No concrete provider is chosen yet; implementations must satisfy this
// contract so the rest of the read-aloud pipeline never depends on one.

import { TTS_URL } from "$lib/dev";
import { appSettings } from "$lib/settings.svelte";
import type { PipelineEvent, SpeechPipeline } from "./pipeline";

export interface Voice {
  // service-specific unique identifier of the voice, opaque to the rest of
  // the app; services whose names are unique just duplicate the name
  id: string;
  // human-readable name shown in the voice picker
  name: string;
  // BCP-47 language tag of the voice, e.g. "en-US", "cs"
  lang?: string;
  description?: string;
}

export interface SynthesisRequest {
  text: string;
  // Voice.id; undefined lets the service pick its default. The voice
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
  // Optional: true when synthesize applies req.rate into the generated audio
  // (pitch-preserving). The pipeline then keeps the player at normal speed,
  // and a rate change requires re-synthesis.
  readonly appliesRate?: boolean;
  // Voices for the given BCP-47 language (primary subtag match, e.g. "en"
  // and "en-GB" both select "en-*" voices); may be empty when the service
  // has none for it (synthesis then uses the service default voice). All
  // voices when `language` is undefined.
  listVoices(language?: string): Promise<Voice[]>;
  // Rejects with TtsServiceError on service failure; when `signal` aborts,
  // rejects with the abort reason (DOMException "AbortError"), never with
  // TtsServiceError, so cancellations are not mistaken for outages.
  synthesize(req: SynthesisRequest, signal?: AbortSignal): Promise<SynthesisResult>;
  // The playback pipeline appropriate for this service: TtsServicePipeline
  // for services whose synthesize returns audio data, a service-specific
  // implementation for those that play speech themselves (browser).
  createPipeline(onEvent: (e: PipelineEvent) => void): SpeechPipeline;
  // Optional: begin loading/initializing the given voice ahead of playback so
  // the first synthesize is fast (e.g. Piper downloads and warms up the model).
  // No-op for services with nothing to preload.
  preload?(voice?: string): void;
  // Optional: release resources (workers, WASM, audio graph) when read-aloud is
  // disabled. Services holding nothing heavy can omit it.
  destroy?(): void;
}

// primary-subtag language comparison: voice "en-US" matches "en" and "en-GB"
export function matchesLanguage(
  voiceLang: string | undefined,
  language: string,
): boolean {
  if (!voiceLang) return false;
  // Android reports voice languages in Java Locale form ("cs_CZ"), so
  // treat "_" like the BCP-47 "-" separator
  const primary = (tag: string) => tag.toLowerCase().split(/[-_]/)[0];
  return primary(voiceLang) === primary(language);
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

// additional provider-specific parameters entered on the settings page as a
// JSON object; {} when empty or invalid
function serviceParams(): Record<string, unknown> {
  try {
    const parsed = JSON.parse(appSettings.ttsServiceParams);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // invalid JSON is rejected by the settings page already
  }
  return {};
}

// Builds the service selected on the settings page (appSettings.ttsProvider);
// the params object is passed to the provider's constructor, so its keys are
// provider-specific (e.g. {"baseUrl": ...} for edge).
export async function createTtsService(): Promise<TtsService> {
  const params = serviceParams();
  switch (appSettings.ttsProvider) {
    case "mock": {
      const { MockTtsService } = await import("./mock-tts-service");
      return new MockTtsService(
        params as { latencyMs?: number; failEveryNth?: number },
      );
    }
    case "edge": {
      const { EdgeTtsService } = await import("./edge-tts-service");
      return new EdgeTtsService({
        baseUrl: TTS_URL,
        ...(params as { baseUrl?: string }),
      });
    }
    case "piper": {
      // Voice list and voice files come from the mbs4 server via the shared API
      // client (the service defaults to the singleton). Imported here, not at
      // module top, so unit tests of other services don't pull it in.
      const { PiperTtsService } = await import("./piper/piper-tts-service");
      return new PiperTtsService(
        params as {
          numThreads?: number;
          lengthScale?: number;
          noiseScale?: number;
          noiseWScale?: number;
        },
      );
    }
    default: {
      const { BrowserTtsService } = await import("./browser-tts-service");
      return new BrowserTtsService();
    }
  }
}

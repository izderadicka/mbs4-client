// TTS service implementation for the stopgap Edge TTS proxy
// (tts-cz-data repo, ttsdata/serve/edge_proxy.py), which exposes Microsoft
// Edge's neural voices over local HTTP:
//   GET  {base}/voices -> Edge voice list (ShortName/Locale/FriendlyName...)
//   POST {base}/tts    -> { text, voice?, rate?, pitch? } -> audio/mpeg
//
// The proxy runs on its own origin (default http://127.0.0.1:8899) with open
// CORS and NO credentials - unlike the mbs4 backend client, requests must not
// carry cookies (a credentialed request would be blocked by the browser
// against the proxy's wildcard CORS origin).

import { EDGE_TTS_DEFAULT_URL } from "$lib/config";
import {
  TtsServiceError,
  type SynthesisRequest,
  type SynthesisResult,
  type TtsService,
  type Voice,
} from "./tts-service";

interface EdgeVoice {
  ShortName?: string;
  Locale?: string;
  FriendlyName?: string;
  Gender?: string;
}

// numeric rate (1.0 = normal) -> Edge prosody form ("+25%", "-10%")
export function rateToEdgeForm(rate: number): string | undefined {
  const percent = Math.round((rate - 1) * 100);
  if (!Number.isFinite(percent) || percent === 0) return undefined;
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

export class EdgeTtsService implements TtsService {
  readonly id = "edge";
  #baseUrl: string;

  constructor(opts?: { baseUrl?: string }) {
    const base = opts?.baseUrl || EDGE_TTS_DEFAULT_URL;
    this.#baseUrl = base.replace(/\/$/, "");
  }

  async #request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(this.#baseUrl + path, { ...init, signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new TtsServiceError("Edge TTS proxy unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new TtsServiceError(
        `Edge TTS proxy error (status ${response.status})`,
        { retryable },
      );
    }
    return response;
  }

  async listVoices(): Promise<Voice[]> {
    const response = await this.#request("/voices", { method: "GET" });
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new TtsServiceError("Invalid voices response", { retryable: false });
    }
    return (data as EdgeVoice[])
      .filter((v) => v != null && typeof v.ShortName === "string")
      .map((v) => ({
        name: v.ShortName!,
        lang: v.Locale,
        description: v.FriendlyName ?? v.Gender,
      }));
  }

  async synthesize(
    req: SynthesisRequest,
    signal?: AbortSignal,
  ): Promise<SynthesisResult> {
    const body: Record<string, string> = { text: req.text };
    if (req.voice) body.voice = req.voice;
    if (req.rate !== undefined) {
      const rate = rateToEdgeForm(req.rate);
      if (rate) body.rate = rate;
    }
    const response = await this.#request(
      "/tts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
    const mimeType =
      response.headers.get("Content-Type")?.split(";")[0].trim() ||
      "audio/mpeg";
    return { data: await response.arrayBuffer(), mimeType };
  }
}

// REST implementation of the TTS service contract.
//
// NOTE: the backend does not provide a TTS API yet; the endpoint shape below
// is an assumption to be aligned with the real backend when it exists:
//   GET  {TTS_API_PATH}/voices           -> Voice[] as JSON
//   POST {TTS_API_PATH}/synthesize       -> audio bytes, Content-Type = mime
//        body: { text, voice?, rate? }
// The endpoints are intentionally NOT part of the generated OpenAPI client
// (src/lib/api/types.ts) until the backend defines them.

import { apiClient } from "$lib/api/client";
import { TTS_API_PATH } from "$lib/config";
import {
  TtsServiceError,
  type SynthesisRequest,
  type SynthesisResult,
  type TtsService,
  type Voice,
} from "./tts-service";

export class RestTtsService implements TtsService {
  readonly id = "rest";
  #basePath: string;

  constructor(opts?: { basePath?: string }) {
    this.#basePath = opts?.basePath ?? TTS_API_PATH;
  }

  #headers(json: boolean): HeadersInit {
    const headers: Record<string, string> = {};
    if (json) headers["Content-Type"] = "application/json";
    if (apiClient.token) headers["Authorization"] = `Bearer ${apiClient.token}`;
    return headers;
  }

  async #request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await apiClient.fetch(apiClient.fullUrl(this.#basePath + path), {
        ...init,
        credentials: "include",
        signal,
      });
    } catch (e) {
      // abort must not look like a service outage
      if (signal?.aborted) throw e;
      throw new TtsServiceError("TTS service unreachable", {
        retryable: true,
        cause: e,
      });
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new TtsServiceError(`TTS service error (status ${response.status})`, {
        retryable,
      });
    }
    return response;
  }

  async listVoices(): Promise<Voice[]> {
    const response = await this.#request("/voices", {
      method: "GET",
      headers: this.#headers(false),
    });
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new TtsServiceError("Invalid voices response", { retryable: false });
    }
    return data.filter(
      (v): v is Voice => v != null && typeof v.name === "string",
    );
  }

  async synthesize(
    req: SynthesisRequest,
    signal?: AbortSignal,
  ): Promise<SynthesisResult> {
    const response = await this.#request(
      "/synthesize",
      {
        method: "POST",
        headers: this.#headers(true),
        body: JSON.stringify({
          text: req.text,
          voice: req.voice,
          rate: req.rate,
        }),
      },
      signal,
    );
    const mimeType =
      response.headers.get("Content-Type")?.split(";")[0].trim() ||
      "application/octet-stream";
    return { data: await response.arrayBuffer(), mimeType };
  }
}

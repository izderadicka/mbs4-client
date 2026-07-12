import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch, mockApiClient } = vi.hoisted(() => {
  const mockFetch = vi.fn();
  return {
    mockFetch,
    mockApiClient: {
      token: null as string | null,
      fetch: mockFetch,
      fullUrl: (path: string) => `http://api.test${path}`,
    },
  };
});

vi.mock("$lib/api/client", () => ({ apiClient: mockApiClient }));

import { RestTtsService } from "./rest-tts-service";
import { TtsServiceError } from "./tts-service";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("RestTtsService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockApiClient.token = null;
  });

  it("fetches voices from the assumed endpoint with credentials", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse([{ name: "Alice", lang: "en" }, { bogus: true }, null]),
    );
    const svc = new RestTtsService();
    const voices = await svc.listVoices();
    expect(voices).toEqual([{ name: "Alice", lang: "en" }]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://api.test/api/tts/voices");
    expect(init.credentials).toBe("include");
  });

  it("sends bearer token when apiClient has one", async () => {
    mockApiClient.token = "jwt-token";
    mockFetch.mockResolvedValue(jsonResponse([]));
    await new RestTtsService().listVoices();
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
  });

  it("POSTs synthesis request and returns bytes with mime from Content-Type", async () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    mockFetch.mockResolvedValue(
      new Response(audio, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg; charset=binary" },
      }),
    );
    const svc = new RestTtsService();
    const result = await svc.synthesize({
      text: "Hello.",
      voice: "Alice",
      rate: 1.5,
    });
    expect(result.mimeType).toBe("audio/mpeg");
    expect(new Uint8Array(result.data)).toEqual(audio);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://api.test/api/tts/synthesize");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      text: "Hello.",
      voice: "Alice",
      rate: 1.5,
    });
  });

  it.each([
    [500, true],
    [503, true],
    [429, true],
    [400, false],
    [401, false],
    [404, false],
  ])("maps status %i to retryable=%s", async (status, retryable) => {
    mockFetch.mockResolvedValue(new Response("err", { status }));
    const err = await new RestTtsService()
      .synthesize({ text: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(retryable);
  });

  it("maps network failure to retryable TtsServiceError", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));
    const err = await new RestTtsService()
      .synthesize({ text: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(true);
  });

  it("passes AbortSignal through and rethrows abort as-is", async () => {
    const ac = new AbortController();
    mockFetch.mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBe(ac.signal);
      ac.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const err = await new RestTtsService()
      .synthesize({ text: "x" }, ac.signal)
      .catch((e) => e);
    expect(err).not.toBeInstanceOf(TtsServiceError);
    expect(err.name).toBe("AbortError");
  });

  it("rejects non-array voices response as non-retryable", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ not: "an array" }));
    const err = await new RestTtsService().listVoices().catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(false);
  });
});

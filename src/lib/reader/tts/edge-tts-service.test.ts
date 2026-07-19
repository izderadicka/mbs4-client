import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EdgeTtsService, rateToEdgeForm } from "./edge-tts-service";
import { TtsServiceError } from "./tts-service";

const mockFetch = vi.fn();

describe("rateToEdgeForm", () => {
  it("converts numeric rates to Edge prosody strings", () => {
    expect(rateToEdgeForm(1)).toBeUndefined();
    expect(rateToEdgeForm(1.25)).toBe("+25%");
    expect(rateToEdgeForm(2)).toBe("+100%");
    expect(rateToEdgeForm(0.75)).toBe("-25%");
  });
});

describe("EdgeTtsService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Edge voice entries to the Voice contract", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            ShortName: "cs-CZ-AntoninNeural",
            Locale: "cs-CZ",
            FriendlyName: "Microsoft Antonin Online (Natural) - Czech (Czechia)",
            Gender: "Male",
          },
          { Locale: "cs-CZ" }, // no ShortName - dropped
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const svc = new EdgeTtsService({ baseUrl: "http://proxy.test:8899/" });
    const voices = await svc.listVoices();
    expect(voices).toEqual([
      {
        name: "cs-CZ-AntoninNeural",
        lang: "cs-CZ",
        description: "Microsoft Antonin Online (Natural) - Czech (Czechia)",
      },
    ]);
    // trailing slash normalized away
    expect(mockFetch.mock.calls[0][0]).toBe("http://proxy.test:8899/voices");
    // no credentials against the wildcard-CORS proxy
    expect(mockFetch.mock.calls[0][1].credentials).toBeUndefined();
  });

  it("filters voices by language", async () => {
    const body = JSON.stringify([
      { ShortName: "cs-CZ-AntoninNeural", Locale: "cs-CZ" },
      { ShortName: "en-GB-SoniaNeural", Locale: "en-GB" },
      { ShortName: "en-US-AriaNeural", Locale: "en-US" },
    ]);
    mockFetch.mockImplementation(async () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const svc = new EdgeTtsService();
    expect((await svc.listVoices("en")).map((v) => v.name)).toEqual([
      "en-GB-SoniaNeural",
      "en-US-AriaNeural",
    ]);
    expect((await svc.listVoices("cs-CZ")).map((v) => v.name)).toEqual([
      "cs-CZ-AntoninNeural",
    ]);
    expect(await svc.listVoices("de")).toEqual([]);
    expect((await svc.listVoices()).length).toBe(3);
  });

  it("POSTs text and voice and returns MP3 bytes", async () => {
    const audio = new Uint8Array([9, 8, 7]);
    mockFetch.mockResolvedValue(
      new Response(audio, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    const svc = new EdgeTtsService({ baseUrl: "http://proxy.test:8899" });
    const result = await svc.synthesize({
      text: "Příliš žluťoučký kůň.",
      voice: "cs-CZ-VlastaNeural",
      rate: 1.5,
    });
    expect(result.mimeType).toBe("audio/mpeg");
    expect(new Uint8Array(result.data)).toEqual(audio);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://proxy.test:8899/tts");
    expect(JSON.parse(init.body)).toEqual({
      text: "Příliš žluťoučký kůň.",
      voice: "cs-CZ-VlastaNeural",
      rate: "+50%",
    });
  });

  it("omits rate at normal speed", async () => {
    mockFetch.mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    const svc = new EdgeTtsService();
    await svc.synthesize({ text: "Ahoj.", voice: "cs-CZ-AntoninNeural", rate: 1 });
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      text: "Ahoj.",
      voice: "cs-CZ-AntoninNeural",
    });
  });

  it.each([
    [500, true],
    [429, true],
    [400, false],
  ])("maps status %i to retryable=%s", async (status, retryable) => {
    mockFetch.mockResolvedValue(new Response("err", { status }));
    const err = await new EdgeTtsService()
      .synthesize({ text: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(retryable);
  });

  it("maps network failure to retryable and abort to AbortError", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));
    const err = await new EdgeTtsService().listVoices().catch((e) => e);
    expect(err).toBeInstanceOf(TtsServiceError);
    expect(err.retryable).toBe(true);

    const ac = new AbortController();
    mockFetch.mockImplementation(() => {
      ac.abort();
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    const err2 = await new EdgeTtsService()
      .synthesize({ text: "x" }, ac.signal)
      .catch((e) => e);
    expect(err2).not.toBeInstanceOf(TtsServiceError);
    expect(err2.name).toBe("AbortError");
  });
});

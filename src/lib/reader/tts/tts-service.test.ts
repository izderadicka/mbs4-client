import { beforeEach, describe, expect, it, vi } from "vitest";

// createTtsService reads the provider and params from appSettings, which is
// initialized from localStorage at module load - reset modules per test.
describe("matchesLanguage", () => {
  it("matches on the primary subtag, case-insensitively", async () => {
    const { matchesLanguage } = await import("./tts-service");
    expect(matchesLanguage("en-US", "en")).toBe(true);
    expect(matchesLanguage("en-US", "en-GB")).toBe(true);
    expect(matchesLanguage("EN", "en-us")).toBe(true);
    expect(matchesLanguage("cs", "en")).toBe(false);
    expect(matchesLanguage(undefined, "en")).toBe(false);
  });

  it("accepts Android's underscore locale form on either side", async () => {
    const { matchesLanguage } = await import("./tts-service");
    expect(matchesLanguage("cs_CZ", "cs")).toBe(true);
    expect(matchesLanguage("en_US", "en-GB")).toBe(true);
    expect(matchesLanguage("cs-CZ", "cs_CZ")).toBe(true);
    expect(matchesLanguage("de_DE", "cs")).toBe(false);
  });
});

describe("createTtsService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function create(provider?: string, params?: string) {
    if (provider !== undefined || params !== undefined) {
      localStorage.setItem(
        "mbs4.settings",
        JSON.stringify({ ttsProvider: provider, ttsServiceParams: params }),
      );
    }
    const { createTtsService } = await import("./tts-service");
    return createTtsService();
  }

  it("defaults to the browser service", async () => {
    expect((await create()).id).toBe("browser");
  });

  it("builds the service selected in settings", async () => {
    expect((await create("mock")).id).toBe("mock");
    vi.resetModules();
    expect((await create("edge")).id).toBe("edge");
  });

  it("passes JSON params to the provider", async () => {
    const svc = await create("edge", '{"baseUrl": "http://params.test:1234"}');
    const mockFetch = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
    try {
      await svc.listVoices();
      expect(mockFetch.mock.calls[0][0]).toBe("http://params.test:1234/voices");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("ignores empty or invalid params", async () => {
    // invalid params are sanitized away on load; the service still builds
    const svc = await create("mock", "");
    expect(svc.id).toBe("mock");
  });
});

describe("createTtsService reuse", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function load(provider: string, params = "") {
    localStorage.setItem(
      "mbs4.settings",
      JSON.stringify({ ttsProvider: provider, ttsServiceParams: params }),
    );
    const mod = await import("./tts-service");
    const { appSettings } = await import("$lib/settings.svelte");
    const { TTS_SERVICE_KEEP_MS } = await import("$lib/config");
    return { ...mod, appSettings, keepMs: TTS_SERVICE_KEEP_MS };
  }

  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("hands out the same instance while the settings stay the same", async () => {
    const { createTtsService } = await load("mock");
    const a = await createTtsService();
    const b = await createTtsService();
    expect(b).toBe(a);
  });

  it("keeps a released service for a while, then destroys it", async () => {
    vi.useFakeTimers();
    try {
      const { createTtsService, releaseTtsService, keepMs } =
        await load("mock");
      const svc = await createTtsService();
      const destroy = vi.fn();
      svc.destroy = destroy;
      releaseTtsService(svc);
      await vi.advanceTimersByTimeAsync(keepMs - 1000);
      expect(destroy).not.toHaveBeenCalled();
      // taken back within the keep period - no destroy, same instance
      expect(await createTtsService()).toBe(svc);
      await vi.advanceTimersByTimeAsync(keepMs * 2);
      expect(destroy).not.toHaveBeenCalled();
      // released for good
      releaseTtsService(svc);
      await vi.advanceTimersByTimeAsync(keepMs + 1000);
      expect(destroy).toHaveBeenCalledTimes(1);
      // and a fresh one is built next time
      expect(await createTtsService()).not.toBe(svc);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not destroy while another user still holds the service", async () => {
    vi.useFakeTimers();
    try {
      const { createTtsService, releaseTtsService, keepMs } =
        await load("mock");
      const svc = await createTtsService();
      await createTtsService(); // second user (e.g. reader remounted)
      const destroy = vi.fn();
      svc.destroy = destroy;
      releaseTtsService(svc);
      await vi.advanceTimersByTimeAsync(keepMs * 2);
      expect(destroy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces and destroys the service when the settings change", async () => {
    const { createTtsService, appSettings } = await load("mock");
    const old = await createTtsService();
    const destroy = vi.fn();
    old.destroy = destroy;
    appSettings.ttsProvider = "edge";
    const fresh = await createTtsService();
    await flush();
    expect(fresh.id).toBe("edge");
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

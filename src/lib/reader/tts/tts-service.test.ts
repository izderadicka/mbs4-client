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

import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "mbs4.tts";

// ttsPrefs is initialized from localStorage at module load time, so each
// test resets the module registry and re-imports to get a fresh instance.
describe("tts-prefs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("returns defaults when localStorage is empty", async () => {
    const { ttsPrefs } = await import("./tts-prefs.svelte");
    expect(ttsPrefs.voice).toBeNull();
    expect(ttsPrefs.rate).toBe(1);
  });

  it("restores valid stored values", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voice: "Alice", rate: 1.5 }),
    );
    const { ttsPrefs } = await import("./tts-prefs.svelte");
    expect(ttsPrefs.voice).toBe("Alice");
    expect(ttsPrefs.rate).toBe(1.5);
  });

  it("falls back invalid rate to default while preserving voice", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ voice: "Alice", rate: 42 }),
    );
    const { ttsPrefs } = await import("./tts-prefs.svelte");
    expect(ttsPrefs.voice).toBe("Alice");
    expect(ttsPrefs.rate).toBe(1);
  });

  it("falls back non-string or empty voice to default", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ voice: "", rate: 2 }));
    const { ttsPrefs } = await import("./tts-prefs.svelte");
    expect(ttsPrefs.voice).toBeNull();
    expect(ttsPrefs.rate).toBe(2);
  });

  it("returns defaults on corrupt JSON", async () => {
    localStorage.setItem(STORAGE_KEY, "not-json{{{");
    const { ttsPrefs } = await import("./tts-prefs.svelte");
    expect(ttsPrefs.voice).toBeNull();
    expect(ttsPrefs.rate).toBe(1);
  });

  it("setTtsVoice updates prefs and persists to localStorage", async () => {
    const { ttsPrefs, setTtsVoice } = await import("./tts-prefs.svelte");
    setTtsVoice("Bob");
    expect(ttsPrefs.voice).toBe("Bob");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).voice).toBe("Bob");
  });

  it("setTtsRate updates prefs and persists to localStorage", async () => {
    const { ttsPrefs, setTtsRate } = await import("./tts-prefs.svelte");
    setTtsRate(1.25);
    expect(ttsPrefs.rate).toBe(1.25);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).rate).toBe(1.25);
  });
});

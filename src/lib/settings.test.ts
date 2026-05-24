import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "mbs4.settings";

// appSettings is initialized from localStorage at module load time, so each
// test resets the module registry and re-imports to get a fresh instance.
describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe("loadSettings", () => {
    it("returns all defaults when localStorage is empty", async () => {
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(10);
      expect(appSettings.ebookLayout).toBe("grid");
      expect(appSettings.searchResultsLimit).toBe(20);
    });

    it("restores all valid stored values", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 25, ebookLayout: "table", searchResultsLimit: 50 }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(25);
      expect(appSettings.ebookLayout).toBe("table");
      expect(appSettings.searchResultsLimit).toBe(50);
    });

    it("falls back invalid pageSize to default while preserving other fields", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 999, ebookLayout: "table", searchResultsLimit: 50 }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(10);
      expect(appSettings.ebookLayout).toBe("table");
      expect(appSettings.searchResultsLimit).toBe(50);
    });

    it("falls back invalid ebookLayout to default while preserving other fields", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 25, ebookLayout: "carousel", searchResultsLimit: 100 }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(25);
      expect(appSettings.ebookLayout).toBe("grid");
      expect(appSettings.searchResultsLimit).toBe(100);
    });

    it("falls back invalid searchResultsLimit to default while preserving other fields", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 25, ebookLayout: "table", searchResultsLimit: 999 }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(25);
      expect(appSettings.ebookLayout).toBe("table");
      expect(appSettings.searchResultsLimit).toBe(20);
    });

    it("returns all defaults on corrupt JSON", async () => {
      localStorage.setItem(STORAGE_KEY, "not-json{{{");
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.pageSize).toBe(10);
      expect(appSettings.ebookLayout).toBe("grid");
      expect(appSettings.searchResultsLimit).toBe(20);
    });
  });

  describe("onlineSearches", () => {
    const DEFAULT_ENGINE = {
      name: "Databáze knih",
      urlTemplate:
        "https://www.databazeknih.cz/vyhledavani/knihy?q={title}+{author_last}",
    };

    it("returns the default engine when localStorage is empty", async () => {
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual([DEFAULT_ENGINE]);
    });

    it("round-trips a valid stored array of multiple engines", async () => {
      const stored = [
        DEFAULT_ENGINE,
        { name: "Google", urlTemplate: "https://www.google.com/search?q={title}" },
      ];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ onlineSearches: stored }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual(stored);
    });

    it("falls back to default when onlineSearches is null", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 10, onlineSearches: null }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual([DEFAULT_ENGINE]);
    });

    it("falls back to default when onlineSearches is a string", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pageSize: 10, onlineSearches: "garbage" }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual([DEFAULT_ENGINE]);
    });

    it("accepts an empty stored array (user removed all engines)", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ onlineSearches: [] }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual([]);
    });

    it("drops invalid entries while keeping valid ones", async () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          onlineSearches: [
            DEFAULT_ENGINE,
            { name: "", urlTemplate: "https://x/?q={title}" },
            { name: "NoScheme", urlTemplate: "example.com/?q={title}" },
            { name: "OK", urlTemplate: "https://x/?q={title}" },
            null,
          ],
        }),
      );
      const { appSettings } = await import("$lib/settings.svelte");
      expect(appSettings.onlineSearches).toEqual([
        DEFAULT_ENGINE,
        { name: "OK", urlTemplate: "https://x/?q={title}" },
      ]);
    });

    it("setOnlineSearches updates appSettings and persists to localStorage", async () => {
      const { appSettings, setOnlineSearches } = await import(
        "$lib/settings.svelte"
      );
      const next = [
        { name: "Goodreads", urlTemplate: "https://www.goodreads.com/search?q={title}" },
      ];
      setOnlineSearches(next);
      expect(appSettings.onlineSearches).toEqual(next);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).onlineSearches).toEqual(
        next,
      );
    });

    it("setOnlineSearches filters invalid entries before persisting", async () => {
      const { appSettings, setOnlineSearches } = await import(
        "$lib/settings.svelte"
      );
      setOnlineSearches([
        { name: "OK", urlTemplate: "https://x/?q={title}" },
        { name: "", urlTemplate: "https://x/?q={title}" },
        { name: "NoScheme", urlTemplate: "x/?q={title}" },
      ]);
      expect(appSettings.onlineSearches).toEqual([
        { name: "OK", urlTemplate: "https://x/?q={title}" },
      ]);
    });
  });

  describe("setters", () => {
    it("setPageSize updates appSettings and persists to localStorage", async () => {
      const { appSettings, setPageSize } = await import("$lib/settings.svelte");
      setPageSize(50);
      expect(appSettings.pageSize).toBe(50);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).pageSize).toBe(50);
    });

    it("setEbookLayout updates appSettings and persists to localStorage", async () => {
      const { appSettings, setEbookLayout } = await import("$lib/settings.svelte");
      setEbookLayout("table");
      expect(appSettings.ebookLayout).toBe("table");
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).ebookLayout).toBe("table");
    });

    it("setSearchResultsLimit updates appSettings and persists to localStorage", async () => {
      const { appSettings, setSearchResultsLimit } = await import("$lib/settings.svelte");
      setSearchResultsLimit(100);
      expect(appSettings.searchResultsLimit).toBe(100);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).searchResultsLimit).toBe(100);
    });
  });
});

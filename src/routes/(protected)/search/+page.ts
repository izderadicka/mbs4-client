import { apiClient } from "$lib/api/client";

// Kept in sync with SEARCH_RESULT_LIMITS in settings.svelte.ts — cannot import due to pipeline separation
const SETTINGS_KEY = "mbs4.settings";
const VALID_SEARCH_LIMITS = [10, 20, 50, 100, 200, 500];
const DEFAULT_SEARCH_LIMIT = 20;

const SEARCH_WHATS = ["ebook", "author", "series"] as const;
export type SearchWhat = (typeof SEARCH_WHATS)[number];

function getSearchLimit(): number {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SEARCH_LIMIT;
    const v = Number(JSON.parse(raw).searchResultsLimit);
    return VALID_SEARCH_LIMITS.includes(v) ? v : DEFAULT_SEARCH_LIMIT;
  } catch {
    return DEFAULT_SEARCH_LIMIT;
  }
}

function parseWhat(value: string | null): SearchWhat {
  return SEARCH_WHATS.includes(value as SearchWhat)
    ? (value as SearchWhat)
    : "ebook";
}

export async function load({ url }) {
  const query = url.searchParams.get("q") ?? "";
  const what = parseWhat(url.searchParams.get("what"));
  const limit = getSearchLimit();

  // Each branch returns a literal `what` correlated with its result type so the
  // page can narrow `data.results` by `data.what` (discriminated union).
  try {
    if (what === "author") {
      const results = query ? await apiClient.searchAuthor(query, limit) : [];
      return { initialQuery: query, what, results };
    }
    if (what === "series") {
      const results = query ? await apiClient.searchSeries(query, limit) : [];
      return { initialQuery: query, what, results };
    }
    const results = query ? await apiClient.searchEbook(query, limit) : [];
    return { initialQuery: query, what, results };
  } catch (e) {
    console.error(`Failed to search ${what}`, e);
    return { initialQuery: query, what, results: [] };
  }
}

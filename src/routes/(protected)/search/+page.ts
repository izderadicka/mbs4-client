import { apiClient } from "$lib/api/client";

// Kept in sync with SEARCH_RESULT_LIMITS in settings.svelte.ts — cannot import due to pipeline separation
const SETTINGS_KEY = "mbs4.settings";
const VALID_SEARCH_LIMITS = [10, 20, 50, 100, 200, 500];
const DEFAULT_SEARCH_LIMIT = 20;

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

export async function load({ url }) {
  const query = url.searchParams.get("q");
  if (!query) {
    return { initialQuery: "", ebooks: [] };
  }
  try {
    const ebooks = await apiClient.searchEbook(query, getSearchLimit());
    return { initialQuery: query, ebooks };
  } catch (e) {
    console.error("Failed to search ebooks", e);
  }
}

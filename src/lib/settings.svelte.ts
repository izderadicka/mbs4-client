const STORAGE_KEY = "mbs4.settings";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const EBOOK_LAYOUTS = ["grid", "table"] as const;
export type EbookLayout = (typeof EBOOK_LAYOUTS)[number];

export const SEARCH_RESULT_LIMITS = [10, 20, 50, 100, 200, 500] as const;
export type SearchResultLimit = (typeof SEARCH_RESULT_LIMITS)[number];

export interface AppSettings {
  pageSize: PageSize;
  ebookLayout: EbookLayout;
  searchResultsLimit: SearchResultLimit;
}

const DEFAULTS: AppSettings = {
  pageSize: 10,
  ebookLayout: "grid",
  searchResultsLimit: 20,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      pageSize: (PAGE_SIZES as readonly number[]).includes(parsed.pageSize)
        ? parsed.pageSize
        : DEFAULTS.pageSize,
      ebookLayout: (EBOOK_LAYOUTS as readonly string[]).includes(parsed.ebookLayout)
        ? parsed.ebookLayout
        : DEFAULTS.ebookLayout,
      searchResultsLimit: (SEARCH_RESULT_LIMITS as readonly number[]).includes(
        parsed.searchResultsLimit,
      )
        ? parsed.searchResultsLimit
        : DEFAULTS.searchResultsLimit,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appSettings));
}

export const appSettings: AppSettings = $state(loadSettings());

export function setPageSize(v: PageSize) {
  appSettings.pageSize = v;
  persist();
}

export function setEbookLayout(v: EbookLayout) {
  appSettings.ebookLayout = v;
  persist();
}

export function setSearchResultsLimit(v: SearchResultLimit) {
  appSettings.searchResultsLimit = v;
  persist();
}

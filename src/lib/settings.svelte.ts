const STORAGE_KEY = "mbs4.settings";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export const EBOOK_LAYOUTS = ["grid", "table"] as const;
export type EbookLayout = (typeof EBOOK_LAYOUTS)[number];

export const SEARCH_RESULT_LIMITS = [10, 20, 50, 100, 200, 500] as const;
export type SearchResultLimit = (typeof SEARCH_RESULT_LIMITS)[number];

export interface OnlineSearch {
  name: string;
  urlTemplate: string;
}

export interface AppSettings {
  pageSize: PageSize;
  ebookLayout: EbookLayout;
  searchResultsLimit: SearchResultLimit;
  onlineSearches: OnlineSearch[];
}

const DEFAULT_ONLINE_SEARCHES: OnlineSearch[] = [
  {
    name: "Databáze knih",
    urlTemplate:
      "https://www.databazeknih.cz/vyhledavani/knihy?q={title}+{author_last}",
  },
];

const DEFAULTS: AppSettings = {
  pageSize: 10,
  ebookLayout: "grid",
  searchResultsLimit: 20,
  onlineSearches: DEFAULT_ONLINE_SEARCHES,
};

function sanitizeOnlineSearches(value: unknown): OnlineSearch[] {
  if (!Array.isArray(value)) return [...DEFAULT_ONLINE_SEARCHES];
  return value.filter(
    (e): e is OnlineSearch =>
      e != null &&
      typeof e === "object" &&
      typeof (e as OnlineSearch).name === "string" &&
      (e as OnlineSearch).name.trim().length > 0 &&
      typeof (e as OnlineSearch).urlTemplate === "string" &&
      (e as OnlineSearch).urlTemplate.trim().length > 0 &&
      (e as OnlineSearch).urlTemplate.match(/^https?:\/\//) != null,
  );
}

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
      onlineSearches:
        parsed.onlineSearches === undefined
          ? [...DEFAULT_ONLINE_SEARCHES]
          : sanitizeOnlineSearches(parsed.onlineSearches),
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

export function setOnlineSearches(v: OnlineSearch[]) {
  appSettings.onlineSearches = sanitizeOnlineSearches(v);
  persist();
}

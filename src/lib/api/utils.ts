import { DEFAULT_PAGE_SIZE } from "$lib/config";
import { genresFilter, IdsList } from "./filter";
import { ebookSort, ebookSortQuery } from "./sorting";

// Kept in sync with PAGE_SIZES in settings.svelte.ts — cannot import due to pipeline separation
const SETTINGS_KEY = "mbs4.settings";
const VALID_PAGE_SIZES = [10, 25, 50, 100];

function getStoredPageSize(): number {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PAGE_SIZE;
    const v = Number(JSON.parse(raw).pageSize);
    return VALID_PAGE_SIZES.includes(v) ? v : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function decodeJwt<T = unknown>(token: string): T {
    try {
        const [, payload] = token.split(".");

        if (!payload) {
            throw new Error("Invalid JWT: no payload found");
        }

        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(
            base64.length + ((4 - (base64.length % 4)) % 4),
            "=",
        );

        const json =
            typeof window === "undefined"
                ? // @ts-ignore
                Buffer.from(padded, "base64").toString("utf-8")
                : atob(padded); // Browser

        return JSON.parse(json) as T;
    } catch (err) {
        throw new Error(`Failed to decode JWT: ${(err as Error).message}`);
    }
}

export function getListingParams(url: URL) {
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSizeParam = url.searchParams.get("page_size");
    // URL param wins; falls back to stored setting, then config default
    const pageSize = pageSizeParam ? parseInt(pageSizeParam) : getStoredPageSize();
    const sort = url.searchParams.get("sort") || undefined;

    return {
        page,
        page_size: pageSize,
        sort,
    };
}

export async function prepareEbookQuery(url: URL, isSeries?: boolean) {
    const { page, page_size, sort } = getListingParams(url)

    const genresParam = url.searchParams.get("genres") || undefined;
    const genres = genresParam ? await genresFilter(genresParam) : undefined;
    const genresIds = IdsList(genres);
    const sortValue = ebookSort(sort, isSeries);

    return {
        query: {
            page,
            page_size,
            sort: ebookSortQuery(sortValue),
            filter: genresIds ? `genres=${genresIds}` : undefined,
        },
        values: {
            genres,
            sort: sortValue,
        },
    };
}
import { DEFAULT_PAGE_SIZE } from "$lib/config";
import { genresFilter, IdsList } from "./filter";
import { ebookSort, ebookSortQuery } from "./sorting";

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

export function getListingParams(url: URL,) {
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(
        url.searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE),
    );
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
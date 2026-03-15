import { apiClient } from "$lib/api/client";
import { bookshelfSort, bookshelfSortQuery } from "$lib/api/sorting";
import { getListingParams } from "$lib/api/utils";

export async function load({ url }) {
    const query = getListingParams(url)
    const sortValue = bookshelfSort(query.sort);
    query.sort = bookshelfSortQuery(sortValue);

    const publicOnly = url.searchParams.get("public") != null;


    let bookshelves = await apiClient.listBookshelves(publicOnly, query);
    return {
        bookshelves,
        sort: sortValue,
        publicOnly
    };
}
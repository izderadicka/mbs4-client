import { apiClient } from "$lib/api/client";
import { authorSort, authorSortQuery } from "$lib/api/sorting";
import { getListingParams } from "$lib/api/utils";

export async function load({ url }) {
    const query = getListingParams(url)
    const sortValue = authorSort(query.sort);
    query.sort = authorSortQuery(sortValue);


    let authors = await apiClient.listAuthors(query);
    return {
        authors,
        sort: sortValue,
    };
}
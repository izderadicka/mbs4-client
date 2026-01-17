import { apiClient } from "$lib/api/client";
import { seriesSort, seriesSortQuery } from "$lib/api/sorting";
import { getListingParams } from "$lib/api/utils";

export async function load({ url }) {
    const query = getListingParams(url)
    const sortValue = seriesSort(query.sort);
    query.sort = seriesSortQuery(sortValue);


    let series = await apiClient.listSeries(query);
    return {
        series,
        sort: sortValue,
    };
}
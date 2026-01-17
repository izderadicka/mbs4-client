import { apiClient } from "$lib/api/client";
import { prepareEbookQuery } from "$lib/api/utils";

export async function load({ params, url }) {
    const seriesId: number = parseInt(params.id);
    const seriesPromise = apiClient.getSeries(seriesId);
    const getEbooks = async () => {
        const { query, values } = await prepareEbookQuery(url, true);
        const ebooks = await apiClient.listSeriesEbooks(seriesId, query);
        return {
            ebooks,
            ...values
        };
    };
    const ebooksPromise = getEbooks();

    const [series, ebooksResult] = await Promise.all([seriesPromise, ebooksPromise]);
    return {
        series,
        ...ebooksResult
    };
}
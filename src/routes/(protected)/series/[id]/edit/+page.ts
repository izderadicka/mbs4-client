import { apiClient } from "$lib/api/client";


export async function load({ params }) {
    const seriesId: number = parseInt(params.id);
    const seriesFuture = apiClient.getSeries(seriesId);
    const seriesBooksFuture = apiClient.listSeriesEbooks(seriesId, { page_size: 1 });
    const [series, books] = await Promise.all([seriesFuture, seriesBooksFuture]);
    return { series, hasBooks: books.total > 0 };
}
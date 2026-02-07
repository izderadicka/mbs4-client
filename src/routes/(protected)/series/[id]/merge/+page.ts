import { apiClient } from "$lib/api/client";

export async function load({ params }) {
    const seriesId: number = parseInt(params.id);
    const series = await apiClient.getSeries(seriesId);

    return {
        series,
    };
}
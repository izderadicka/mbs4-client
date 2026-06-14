import { apiClient } from "$lib/api/client";

export async function load({ params }) {
    const id: number = parseInt(params.id);
    const [batch, items] = await Promise.all([
        apiClient.getConversionBatch(id),
        apiClient.listConversionBatchItems(id),
    ]);
    return { batch, items };
}

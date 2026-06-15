import { apiClient } from "$lib/api/client";
import { getListingParams } from "$lib/api/utils";

export async function load({ url }) {
    const params = getListingParams(url);
    const batches = await apiClient.listConversionBatches(params);
    return { batches };
}

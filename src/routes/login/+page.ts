import { apiClient } from "$lib/api/client";

export async function load() {
    const providers = await apiClient.listProviders();
    return { providers };
}
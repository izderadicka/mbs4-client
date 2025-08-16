import { apiClient } from "$lib/api/client";


export async function load() {
    return {
        ebooks: await apiClient.listEbooks({ page_size: 10 })
    };
}
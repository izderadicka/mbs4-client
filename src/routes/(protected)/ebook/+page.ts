import { apiClient } from "$lib/api/client";


export async function load({ url }) {
    const page = parseInt(url.searchParams.get('page') || "1");
    const pageSize = parseInt(url.searchParams.get('page_size') || "10");

    const ebooks = await apiClient.listEbooks({ page_size: pageSize, page });

    return {
        ebooks
    };
}
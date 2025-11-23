import { apiClient } from "$lib/api/client";


export async function load({ url }) {

    let authors = await apiClient.listAuthors();
    return {
        authors,
    };
}
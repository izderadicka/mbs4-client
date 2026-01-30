import { apiClient } from "$lib/api/client";

export async function load({ params, url }) {
    const authorId: number = parseInt(params.id);
    const author = await apiClient.getAuthor(authorId);

    return {
        author
    }
}

import { apiClient } from "$lib/api/client";

export async function load({ params }) {
    const authorId: number = parseInt(params.id);
    const authorPromise = apiClient.getAuthor(authorId);

    const [author] = await Promise.all([authorPromise]);
    return {
        author,
    };
}
import { apiClient } from "$lib/api/client";

export async function load({ params, url }) {
    const authorId: number = parseInt(params.id);
    const authorFuture = apiClient.getAuthor(authorId);
    const authorBooks = apiClient.listAuthorEbooks(authorId, { page_size: 1 });
    const [author, books] = await Promise.all([authorFuture, authorBooks]);
    const hasBooks = books.total > 0;

    return {
        author,
        hasBooks
    }
}

import { apiClient } from "$lib/api/client";

export async function load({ params, url }) {
    const bookshelfId: number = parseInt(params.id);
    const bookshelf = await apiClient.getBookshelf(bookshelfId);


    return {
        bookshelf,
    }
}

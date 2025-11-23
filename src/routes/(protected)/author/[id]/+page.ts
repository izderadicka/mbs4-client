import { apiClient } from "$lib/api/client";
import { prepareEbookQuery } from "$lib/api/utils";

export async function load({ params, url }) {
    const authorId: number = parseInt(params.id);
    const authorPromise = apiClient.getAuthor(authorId);
    const getEbooks = async () => {
        const { query, values } = await prepareEbookQuery(url);
        const ebooks = await apiClient.listAuthorEbooks(authorId, query);
        return {
            ebooks,
            ...values
        };
    };
    const ebooksPromise = getEbooks();

    const [author, ebooksResult] = await Promise.all([authorPromise, ebooksPromise]);
    return {
        author,
        ...ebooksResult
    };
}
import { apiClient } from "$lib/api/client";
import { bookshelfItemSort, bookshelfItemSortQuery } from "$lib/api/sorting";
import { getListingParams } from "$lib/api/utils";

export async function load({ params, url }) {
    const bookshelfId: number = parseInt(params.id);
    const bookshelfPromise = apiClient.getBookshelf(bookshelfId);
    const { page, page_size, sort } = getListingParams(url);
    const sortValue = bookshelfItemSort(sort);
    const query = { page, page_size, sort: bookshelfItemSortQuery(sortValue) }
    const itemsPromise = apiClient.listBookshelfItems(bookshelfId, query);

    const [bookshelf, items] = await Promise.all([bookshelfPromise, itemsPromise]);
    return {
        bookshelf,
        items,
        sort: sortValue
    };
}
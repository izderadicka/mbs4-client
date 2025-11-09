import { apiClient } from "$lib/api/client";
import { EBOOK_SORTING_DEFAULT, ebookSort } from "$lib/api/sorting.js";
import { DEFAULT_PAGE_SIZE } from "$lib/config.js";

export async function load({ url }) {
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(
    url.searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE),
  );
  const sort = url.searchParams.get("sort") || undefined;


  const ebooks = await apiClient.listEbooks({ page_size: pageSize, page, sort });

  return {
    ebooks,
    sort: ebookSort(sort),
  };
}

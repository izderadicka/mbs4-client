import { apiClient } from "$lib/api/client";
import { genresFilter, IdsList } from "$lib/api/filter.js";
import { EBOOK_SORTING_DEFAULT, ebookSort } from "$lib/api/sorting.js";
import { DEFAULT_PAGE_SIZE } from "$lib/config.js";

export async function load({ url }) {
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(
    url.searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE),
  );
  const sort = url.searchParams.get("sort") || undefined;
  const genresParam = url.searchParams.get("genres") || undefined;
  const genres = genresParam ? await genresFilter(genresParam) : undefined;
  const genresIds = IdsList(genres);

  const ebooks = await apiClient.listEbooks({ page_size: pageSize, page, sort, filter: genresIds ? `genres=${genresIds}` : undefined });

  return {
    ebooks,
    sort: ebookSort(sort),
    genres,
  };
}

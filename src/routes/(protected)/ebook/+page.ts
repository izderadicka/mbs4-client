import { apiClient } from "$lib/api/client";
import { genresFilter, IdsList } from "$lib/api/filter.js";
import { prepareEbookQuery } from "$lib/api/utils.js";
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

  const { query, values } = await prepareEbookQuery(url);

  const ebooks = await apiClient.listEbooks(query);

  return {
    ebooks,
    ...values
  };
}

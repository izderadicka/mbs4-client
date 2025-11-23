import { apiClient } from "$lib/api/client";
import { genresFilter, IdsList } from "$lib/api/filter.js";
import { prepareEbookQuery } from "$lib/api/utils.js";
import { DEFAULT_PAGE_SIZE } from "$lib/config.js";

export async function load({ url }) {
  const { query, values } = await prepareEbookQuery(url);
  const ebooks = await apiClient.listEbooks(query);

  return {
    ebooks,
    ...values
  };
}

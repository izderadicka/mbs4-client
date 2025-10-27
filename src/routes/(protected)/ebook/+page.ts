import { apiClient } from "$lib/api/client";
import { DEFAULT_PAGE_SIZE } from "$lib/config.js";

export async function load({ url }) {
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(
    url.searchParams.get("page_size") || String(DEFAULT_PAGE_SIZE),
  );

  const ebooks = await apiClient.listEbooks({ page_size: pageSize, page });

  return {
    ebooks,
  };
}

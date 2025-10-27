import { apiClient } from "$lib/api/client";

export async function load({ url }) {
  const query = url.searchParams.get("q");
  if (!query) {
    return { initalQuery: "", ebooks: [] };
  }
  try {
    const ebooks = await apiClient.searchEbook(query, 20);
    return { initialQuery: query, ebooks };
  } catch (e) {
    console.error("Failed to search ebooks", e);
  }
}

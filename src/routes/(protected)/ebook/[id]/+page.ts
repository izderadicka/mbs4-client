import { apiClient } from "$lib/api/client";

export async function load({ params }) {
  const ebookId: number = parseInt(params.id);
  const ebook = await apiClient.getEbook(ebookId);
  return {
    ebook,
  };
}

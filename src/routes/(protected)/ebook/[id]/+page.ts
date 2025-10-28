import { apiClient } from "$lib/api/client";

export async function load({ params }) {
  const ebookId: number = parseInt(params.id);
  const ebookPromise = apiClient.getEbook(ebookId);
  const sourcesPromise = apiClient.listEbookSources(ebookId);

  const [ebook, sources] = await Promise.all([ebookPromise, sourcesPromise]);
  return {
    ebook,
    sources,
  };
}

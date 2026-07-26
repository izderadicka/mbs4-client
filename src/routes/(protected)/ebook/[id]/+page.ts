import { apiClient } from "$lib/api/client";

export async function load({ params }) {
  const ebookId: number = parseInt(params.id);
  const ebookPromise = apiClient.getEbook(ebookId);
  const sourcesPromise = apiClient.listEbookSources(ebookId);
  const conversionsPromise = apiClient.listEbookConversions(ebookId);


  const [ebook, sources, conversions] = await Promise.all([
    ebookPromise,
    sourcesPromise,
    conversionsPromise

  ]);
  let myRating = null;
  if (ebook.rating_count ?? 0 > 0) {
    myRating = await apiClient.getMyEbookRating(ebookId);
  }

  return {
    ebook,
    sources,
    conversions,
    myRating,
  };
}

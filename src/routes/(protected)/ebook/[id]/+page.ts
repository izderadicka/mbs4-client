import { apiClient } from "$lib/api/client";

export async function load({ params }) {
  const ebookId: number = parseInt(params.id);
  const ebookPromise = apiClient.getEbook(ebookId);
  const sourcesPromise = apiClient.listEbookSources(ebookId);
  const conversionsPromise = apiClient.listEbookConversions(ebookId);
  const myRatingPromise = apiClient.getMyEbookRating(ebookId).catch(() => null);

  const [ebook, sources, conversions, myRating] = await Promise.all([
    ebookPromise,
    sourcesPromise,
    conversionsPromise,
    myRatingPromise,
  ]);
  return {
    ebook,
    sources,
    conversions,
    myRating,
  };
}

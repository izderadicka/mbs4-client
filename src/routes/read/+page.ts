import { apiClient } from "$lib/api/client";
import type { Ebook, EbookConversion, EbookSource } from "$lib/api";
import type { PageLoad } from "./$types";

export type BookFileKind = "source" | "conversion";

export interface ReaderData {
  ebook: Ebook | null;
  kind: BookFileKind;
  item: EbookSource | EbookConversion | null;
  error: string | null;
}

export const load: PageLoad = async ({ url }): Promise<ReaderData> => {
  const ebookId = parseInt(url.searchParams.get("ebook") ?? "");
  const sourceId = parseInt(url.searchParams.get("source") ?? "");
  const conversionId = parseInt(url.searchParams.get("conversion") ?? "");
  const kind: BookFileKind = Number.isNaN(conversionId) ? "source" : "conversion";
  const itemId = kind === "conversion" ? conversionId : sourceId;

  if (Number.isNaN(ebookId) || Number.isNaN(itemId)) {
    return { ebook: null, kind, item: null, error: "Missing ebook file reference" };
  }

  try {
    const [ebook, items] = await Promise.all([
      apiClient.getEbook(ebookId),
      kind === "conversion"
        ? apiClient.listEbookConversions(ebookId)
        : apiClient.listEbookSources(ebookId),
    ]);
    const item = items.find((i) => i.id === itemId) ?? null;
    return {
      ebook,
      kind,
      item,
      error: item ? null : `Ebook ${kind} not found`,
    };
  } catch (e) {
    console.error("Failed to load ebook info", e);
    return { ebook: null, kind, item: null, error: "Failed to load ebook info" };
  }
};

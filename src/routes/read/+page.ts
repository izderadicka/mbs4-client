import { apiClient } from "$lib/api/client";
import type { Ebook } from "$lib/api";
import type { PageLoad } from "./$types";

export type BookFileKind = "source" | "conversion";

export interface ReaderItem {
  id: number;
  location: string;
  extension: string;
}

export interface ReaderData {
  ebook: Ebook | null;
  kind: BookFileKind;
  item: ReaderItem | null;
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
    const [ebook, item, formats] = await Promise.all([
      apiClient.getEbook(ebookId),
      kind === "conversion"
        ? apiClient.getConversion(itemId)
        : apiClient.getSource(itemId),
      apiClient.listFormats(),
    ]);
    // Conversion does not carry ebook_id, can be checked only for source
    if ("ebook_id" in item && item.ebook_id !== ebookId) {
      return { ebook, kind, item: null, error: `Ebook ${kind} not found` };
    }
    return {
      ebook,
      kind,
      item: {
        id: item.id,
        location: item.location,
        extension: formats.find((f) => f.id === item.format_id)?.extension ?? "",
      },
      error: null,
    };
  } catch (e) {
    console.error("Failed to load ebook info", e);
    return { ebook: null, kind, item: null, error: "Failed to load ebook info" };
  }
};

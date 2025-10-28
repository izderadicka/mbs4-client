import type { components } from "./types";

export type OperationTicket = components["schemas"]["OperationTicket"];
export type UploadInfo = components["schemas"]["UploadInfo"];
// Series
export type SeriesShort = components["schemas"]["SeriesShort"];
export type CreateSeries = components["schemas"]["CreateSeries"];
export type UpdateSeries = components["schemas"]["UpdateSeries"];
export type Series = components["schemas"]["Series"];

// Ebook
export type Ebook = components["schemas"]["Ebook"];
export type EbookShort = components["schemas"]["EbookShort"];
export type CreateEbook = components["schemas"]["CreateEbook"];
export type UpdateEbook = components["schemas"]["UpdateEbook"];
// Author
export type AuthorShort = components["schemas"]["AuthorShort"];
export type CreateAuthor = components["schemas"]["CreateAuthor"];
export type UpdateAuthor = components["schemas"]["UpdateAuthor"];
export type Author = components["schemas"]["Author"];

export type LanguageShort = components["schemas"]["LanguageShort"];
export type GenreShort = components["schemas"]["GenreShort"];

export type EbookFileInfo = components["schemas"]["EbookFileInfo"];
export type EbookCoverInfo = components["schemas"]["EbookCoverInfo"];
export type Source = components["schemas"]["Source"];
export type EbookSource = components["schemas"]["EbookSource"];

export type EbookDoc = components["schemas"]["EbookDoc"];

export interface EbookSearchItem {
  score: number;
  doc: {
    Ebook: EbookDoc;
  };
}

export interface SeriesSearchItem {
  score: number;
  doc: {
    Series: SeriesShort;
  };
}

export interface AuthorSearchItem {
  score: number;
  doc: {
    Author: AuthorShort;
  };
}

export interface TokenPayload {
  sub: string;
  exp: number;
  iat: number;
  roles: Role[];
}

export interface ListParams {
  page?: number;
  page_size?: number;
  sort?: string;
}

interface ConversionResult {
  operation_id: string;
  created: string; // time::OffsetDateTime will be serialized as an ISO 8601 string
  success: boolean;
  error: string | null;
}

export interface EbookMetadata {
  title: string | null;
  authors: {
    first_name: string | null;
    last_name: string;
  }[];
  genres: string[];
  language: string | null;
  series: {
    title: string;
    index: number;
  } | null;
  cover_file: string | null;
  comments: string | null;
}

export interface MetaResult extends ConversionResult {
  metadata: EbookMetadata | null;
}

export type Role = "Admin" | "Trusted";

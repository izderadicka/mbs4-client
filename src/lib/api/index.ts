import type { components } from "./types";

export type OperationTicket = components["schemas"]["OperationTicket"];
export type UploadInfo = components["schemas"]["UploadInfo"];
export type SearchEbookMeta = components["schemas"]["BookResult"];
export type SeriesShort = components["schemas"]["SeriesShort"];
export type CreateSeries = components["schemas"]["CreateSeries"];
export type UpdateSeries = components["schemas"]["UpdateSeries"];
export type Series = components["schemas"]["Series"];
export type SearchEbookItem = { score: number, doc: SearchEbookMeta }

export interface TokenPayload {
    sub: string;
    exp: number;
    iat: number;
    roles: string[];
}

export interface ListParams {
    page?: number;
    page_size?: number;
    sort?: string;
};

interface ConversionResult {
    operation_id: string;
    created: string;   // time::OffsetDateTime will be serialized as an ISO 8601 string
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

export function decodeJwt<T = unknown>(token: string): T {
    try {
        const [, payload] = token.split('.');

        if (!payload) {
            throw new Error('Invalid JWT: no payload found');
        }

        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');

        const json = typeof window === 'undefined'
            // @ts-ignore
            ? Buffer.from(padded, 'base64').toString('utf-8')
            : atob(padded); // Browser

        return JSON.parse(json) as T;
    } catch (err) {
        throw new Error(`Failed to decode JWT: ${(err as Error).message}`);
    }
}

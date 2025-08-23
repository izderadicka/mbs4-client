import type { components } from "./types";

export type OperationTicket = components["schemas"]["OperationTicket"];
export type UploadInfo = components["schemas"]["UploadInfo"];

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

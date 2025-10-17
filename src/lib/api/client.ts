import type { User } from "$lib/types/app";
import { decodeJwt } from ".";
import type { EbookSearchItem, ListParams, TokenPayload } from ".";
import { appUser } from "$lib/globals.svelte";
import { goto } from "$app/navigation";
import createClient, { type Client } from "openapi-fetch";
import type { paths, components } from "./types";
import { DEV_API_URL } from "$lib/config";
import { IS_DEV } from "$lib/dev";


function getApiBaseUrl(): string {
    const { protocol, hostname, origin } = window.location;

    // Check for localhost + http
    if (
        hostname === 'localhost' &&
        protocol === 'http:' && IS_DEV
    ) {
        return DEV_API_URL
    }

    // Otherwise return the base URL of the current window
    return origin;
}


export class ApiClient {
    token: string | null = null;
    baseUrl: string;
    fetch: typeof fetch = globalThis.fetch;
    client: Client<paths>;
    constructor() {
        console.log("API client created");
        this.baseUrl = getApiBaseUrl();
        this.client = this.newClient();
    }

    setFetch(fetchFn: typeof fetch) {
        this.fetch = fetchFn;
        this.client = this.newClient();
    }

    private newClient() {
        return createClient<paths>({ baseUrl: this.baseUrl, fetch: this.fetch, credentials: "include" });
    }


    fullUrl(path: string) {
        return this.baseUrl + path;
    }


    private extractPayload(token: string): User {
        const payload = decodeJwt<TokenPayload>(token);

        if (payload.exp <= (Date.now() / 1000) + 60) {
            throw new Error("Token expired");
        }

        const user = {
            email: payload.sub,
            roles: payload.roles,
            tokenValidity: payload.exp * 1000,
        };

        return user;
    }



    async login(email: string, password: string): Promise<User> {
        const response = await fetch(this.fullUrl("/auth/login?token=true"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("Login failed");
        }

        const data = await response.text();
        const user = this.extractPayload(data);
        this.token = data;
        return user

    }

    redirectToSSO(provider: string) {

        window.location.href = `${this.baseUrl}/auth/login?oidc_provider=${provider}`;;
    }

    async logout() {
        this.token = null;
        try {
            const response = await this.fetch(this.fullUrl("/auth/logout"), {
                method: "GET",
                credentials: "include"

            });
            if (!response.ok) {
                throw new Error("Logout error " + response.status);
            }
        } catch (error) {
            console.log("Logout failed", error);
        }

    }

    async retrieveToken(trToken: string): Promise<User> {

        const response = await this.fetch(this.fullUrl(`/auth/token?trt=${trToken}`), {
            method: "GET",
            credentials: "include"

        });
        if (response.ok) {
            const data = await response.text();
            const user = this.extractPayload(data);
            this.token = data;
            return user

        }
        else {
            throw new Error("Login failed");
        }

    }


    private checkResponse<T>(response: Response, data?: T): T {
        if (response.status === 401) {
            appUser.user = null;
            goto("/login");
            throw new Error("Unauthorized");
        }
        if (!response.ok) {
            throw new Error("Request failed");
        }

        if (!data) {
            throw new Error("No data");
        }

        return data;

    }

    private async makeRequest(path: string, method: string, body?: any) {
        const raw = body instanceof FormData;
        const headers: Record<string, string> = raw ? {} : {
            "Content-Type": "application/json",

        };
        if (this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }
        const response = await this.fetch(this.fullUrl(path), {
            method,
            headers,
            body: raw ? body : JSON.stringify(body),
            credentials: "include",

        });

        this.checkResponse(response, true);

        return await response.json();
    }



    async uploadFile(form: FormData) {
        // return this.makeRequest("/files/upload/form", "POST", form);
        // @ts-ignore
        const { data, response } = await this.client.POST("/files/upload/form", { body: form });
        return this.checkResponse(response, data);

    }
    async listEbooks(queryParams?: ListParams) {
        const { data, response } = await this.client.GET("/api/ebook", { params: { query: queryParams } });
        return this.checkResponse(response, data);

    }

    async retrieveMetadata(uploadInfo: components["schemas"]["UploadInfo"]) {
        const { data, response } = await this.client.POST("/api/convert/extract_meta", { body: uploadInfo });
        return this.checkResponse(response, data);
    }

    async searchEbook(query: string, limit?: number, signal?: AbortSignal): Promise<EbookSearchItem[]> {
        const { data, response } = await this.client.GET("/search", { signal, params: { query: { query, num_results: limit } } });
        return this.checkResponse(response, data as EbookSearchItem[]);
    }

    createEventSource(lastEventId: string | null): EventSource {
        let url = this.fullUrl("/events");
        if (lastEventId) {
            url += `?lastEventId=${lastEventId}`;
        }
        return new EventSource(url, {
            withCredentials: true,
        });
    }


}





export const apiClient = new ApiClient();
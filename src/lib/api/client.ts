import type { User } from "$lib/types/app";
import { decodeJwt } from "./utils";
import type {
  Author,
  AuthorSearchItem,
  AuthorShort,
  ConversionRequest,
  CreateAuthor,
  CreateEbook,
  CreateSeries,
  Ebook,
  EbookConversion,
  EbookCoverInfo,
  EbookFileInfo,
  EbookSearchItem,
  EbookSource,
  GenreShort,
  LanguageShort,
  LibraryStats,
  ListParams,
  Series,
  SeriesSearchItem,
  Source,
  TokenPayload,
  UpdateEbook,
} from ".";
import { appUser } from "$lib/globals.svelte";
import { goto } from "$app/navigation";
import createClient, { type Client } from "openapi-fetch";
import type { paths, components } from "./types";
import { DEV_API_URL } from "$lib/config";
import { IS_DEV } from "$lib/dev";

function getApiBaseUrl(): string {
  const { protocol, hostname, origin } = window.location;

  // Check for localhost + http
  if (hostname === "localhost" && protocol === "http:" && IS_DEV) {
    return DEV_API_URL;
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
    return createClient<paths>({
      baseUrl: this.baseUrl,
      fetch: this.fetch,
      credentials: "include",
    });
  }

  fullUrl(path: string) {
    return this.baseUrl + path;
  }

  downloadUrl(path: string) {
    return this.fullUrl(`/files/download/${path}`);
  }

  conversionUrl(path: string) {
    return this.fullUrl(`/files/download/conversion/${path}`);
  }

  private extractPayload(token: string): User {
    const payload = decodeJwt<TokenPayload>(token);

    if (payload.exp <= Date.now() / 1000 + 60) {
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
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.text();
    const user = this.extractPayload(data);
    this.token = data;
    return user;
  }

  redirectToSSO(provider: string) {
    window.location.href = `${this.baseUrl}/auth/login?oidc_provider=${provider}`;
  }

  async logout() {
    this.token = null;
    try {
      const response = await this.fetch(this.fullUrl("/auth/logout"), {
        method: "GET",
        credentials: "include",
        redirect: "manual",
      });
      if (response.status >= 400) {
        throw new Error("Logout error " + response.status);
      }
    } catch (error) {
      console.log("Logout failed", error);
    }
  }

  async retrieveToken(trToken: string): Promise<User> {
    const response = await this.fetch(
      this.fullUrl(`/auth/token?trt=${trToken}`),
      {
        method: "GET",
        credentials: "include",
      },
    );
    if (response.ok) {
      const data = await response.text();
      const user = this.extractPayload(data);
      this.token = data;
      return user;
    } else {
      throw new Error("Login failed");
    }
  }

  private checkResponseCode(response: Response) {

    if (response.status === 401) {
      appUser.user = null;
      goto("/login");
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`, { cause: response });
    }

  }
  private checkResponse<T>(response: Response, data?: T): T {
    this.checkResponseCode(response);

    if (!data) {
      throw new Error("No data");
    }

    return data;
  }

  private async makeRequest(path: string, method: string, body?: any) {
    const raw = body instanceof FormData;
    const headers: Record<string, string> = raw
      ? {}
      : {
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
    const { data, response } = await this.client.POST("/files/upload/form", {
      body: form as any,
    });
    try {
      return this.checkResponse(response, data);
    } catch (e) {
      if (e instanceof Error && e.cause instanceof Response && e.cause.status === 409) {
        throw new Error("File with same hash already exists");
      }
      throw e;
    }
  }
  async listEbooks(queryParams?: ListParams) {
    const { data, response } = await this.client.GET("/api/ebook", {
      params: { query: queryParams },
    });
    return this.checkResponse(response, data);
  }

  async listAuthorEbooks(authorId: number, queryParams?: ListParams) {
    const { data, response } = await this.client.GET("/api/author/{id}/ebooks", {
      params: { path: { id: authorId }, query: queryParams },
    });
    return this.checkResponse(response, data);
  }

  async listSeriesEbooks(seriesId: number, queryParams?: ListParams) {
    const { data, response } = await this.client.GET("/api/series/{id}/ebooks", {
      params: { path: { id: seriesId }, query: queryParams },
    });
    return this.checkResponse(response, data);
  }

  async retrieveMetadata(uploadInfo: components["schemas"]["UploadInfo"]) {
    const { data, response } = await this.client.POST(
      "/api/convert/extract_meta",
      { body: uploadInfo },
    );
    return this.checkResponse(response, data);
  }

  async convertSource(conversionRequest: ConversionRequest) {
    const { data, response } = await this.client.POST("/api/convert/convert", {
      body: conversionRequest,
    });
    return this.checkResponse(response, data);
  }

  async deleteConversion(id: number) {
    const { response } = await this.client.DELETE("/api/conversion/{id}", {
      params: { path: { id } },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`, { cause: response });
    }
  }

  async deleteSource(id: number) {
    const { response } = await this.client.DELETE("/api/source/{id}", {
      params: { path: { id } },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`, { cause: response });
    }
  }

  async searchEbook(
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<EbookSearchItem[]> {
    const { data, response } = await this.client.GET("/search", {
      signal,
      params: { query: { query, num_results: limit } },
    });
    return this.checkResponse(response, data as EbookSearchItem[]);
  }

  async searchSeries(
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<SeriesSearchItem[]> {
    const { data, response } = await this.client.GET("/search", {
      signal,
      params: { query: { query, num_results: limit, what: "series" } },
    });
    return this.checkResponse(response, data as SeriesSearchItem[]);
  }

  async searchAuthor(
    query: string,
    limit?: number,
    signal?: AbortSignal,
  ): Promise<AuthorSearchItem[]> {
    const { data, response } = await this.client.GET("/search", {
      signal,
      params: { query: { query, num_results: limit, what: "author" } },
    });
    return this.checkResponse(response, data as AuthorSearchItem[]);
  }

  async getAuthor(id: number): Promise<Author> {
    const { data, response } = await this.client.GET(`/api/author/{id}`, {
      params: { path: { id } },
    });
    return this.checkResponse(response, data);
  }

  async listAuthors(queryParams?: ListParams) {
    const { data, response } = await this.client.GET("/api/author", { params: { query: queryParams } });
    return this.checkResponse(response, data);
  }

  async getSeries(id: number): Promise<Series> {
    const { data, response } = await this.client.GET(`/api/series/{id}`, {
      params: { path: { id } },
    });
    return this.checkResponse(response, data);
  }

  async listSeries(queryParams?: ListParams) {
    const { data, response } = await this.client.GET("/api/series", { params: { query: queryParams } });
    return this.checkResponse(response, data);
  }

  async getEbook(id: number): Promise<Ebook> {
    const { data, response } = await this.client.GET(`/api/ebook/{id}`, {
      params: { path: { id } },
    });
    return this.checkResponse(response, data);
  }
  private langCache: { date: Date; data: LanguageShort[] } | null = null;
  async listLanguages(): Promise<readonly LanguageShort[]> {
    if (
      this.langCache &&
      this.langCache.date > new Date(Date.now() - 1000 * 60 * 60)
    ) {
      return this.langCache.data;
    }
    const { data, response } = await this.client.GET("/api/language/all");
    const languages = this.checkResponse(response, data);
    this.langCache = { date: new Date(), data: languages };
    return languages;
  }

  private genreCache: { date: Date; data: GenreShort[] } | null = null;
  async listGenres(): Promise<readonly GenreShort[]> {
    if (
      this.genreCache &&
      this.genreCache.date > new Date(Date.now() - 1000 * 60 * 60)
    ) {
      return this.genreCache.data;
    }
    const { data, response } = await this.client.GET("/api/genre/all");
    const genres = this.checkResponse(response, data);
    this.genreCache = { date: new Date(), data: genres };
    return genres;
  }

  async listEbookSources(ebookId: number): Promise<EbookSource[]> {
    const { data, response } = await this.client.GET("/api/ebook/{id}/source", {
      params: { path: { id: ebookId } },
    });
    return this.checkResponse(response, data);

  }

  async listEbookConversions(ebookId: number): Promise<EbookConversion[]> {
    const { data, response } = await this.client.GET("/api/ebook/{id}/conversion", {
      params: { path: { id: ebookId } },
    });
    return this.checkResponse(response, data);
  }

  async createSeries(series: CreateSeries): Promise<Series> {
    const { data, response } = await this.client.POST("/api/series", {
      body: series,
    });
    return this.checkResponse(response, data);
  }

  async createAuthor(author: CreateAuthor): Promise<Author> {
    const { data, response } = await this.client.POST("/api/author", {
      body: author,
    });
    return this.checkResponse(response, data);
  }

  async createEbook(ebook: CreateEbook): Promise<Ebook> {
    const { data, response } = await this.client.POST("/api/ebook", {
      body: ebook,
    });
    return this.checkResponse(response, data);
  }

  async updateEbook(ebookId: number, ebook: UpdateEbook): Promise<Ebook> {
    const { data, response } = await this.client.PUT("/api/ebook/{id}", {
      body: ebook,
      params: { path: { id: ebookId } },
    });
    return this.checkResponse(response, data);
  }

  async mergeEbook(id: number, toId: number): Promise<void> {
    const { response } = await this.client.POST("/api/ebook/{id}/merge/{to_id}", {
      params: { path: { id, to_id: toId } },
    });
    return this.checkResponseCode(response);
  }

  async addSourceToEbook(ebookId: number, fileInfo: EbookFileInfo): Promise<Source> {
    const { data, response } = await this.client.POST("/api/ebook/{id}/source", {
      body: fileInfo,
      params: { path: { id: ebookId } },
    });
    return this.checkResponse(response, data);
  }

  async changeEbookCover(ebookId: number, coverInfo: EbookCoverInfo): Promise<Ebook> {
    const { data, response } = await this.client.PUT("/api/ebook/{id}/cover", {
      body: coverInfo,
      params: { path: { id: ebookId } },
    });
    return this.checkResponse(response, data);
  }

  async loadIcon(ebookId: number, signal?: AbortSignal): Promise<Blob | null> {
    const { data } = await this.client.GET("/files/icon/{id}", {
      params: { path: { id: ebookId } },
      parseAs: "blob",
      signal
    });
    return data || null;
  }

  async loadCover(path: string, signal?: AbortSignal): Promise<Blob | null> {

    const { data } = await this.client.GET("/files/download/{path}", {
      params: { path: { path } },
      parseAs: "blob",
      signal
    });
    return data || null;

  }

  async loadExtractedCover(path: string, signal?: AbortSignal): Promise<Blob | null> {

    const { data } = await this.client.GET("/files/download/uploaded/{path}", {
      params: { path: { path } },
      parseAs: "blob",
      signal
    });
    return data || null;
  }

  async getLibraryStats(): Promise<LibraryStats> {
    const res = Promise.all([
      this.client.GET("/api/ebook/count"),
      this.client.GET("/api/series/count"),
      this.client.GET("/api/author/count"),
    ]);
    const [totalEbooks, totalSeries, totalAuthors] = (await res).map((r) => this.checkResponse(r.response, r.data));
    return {
      totalEbooks,
      totalSeries,
      totalAuthors,
    };
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

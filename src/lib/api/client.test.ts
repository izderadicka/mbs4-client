import { beforeEach, describe, expect, it, vi } from "vitest";

const { gotoMock, appUserMock, openApiClientMock } = vi.hoisted(() => ({
  gotoMock: vi.fn(),
  appUserMock: { user: null as null | { email: string; roles: string[] }, failedLogin: false },
  openApiClientMock: {
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("$app/navigation", () => ({
  goto: gotoMock,
}));

vi.mock("$lib/globals.svelte", () => ({
  appUser: appUserMock,
}));

vi.mock("$lib/dev", () => ({
  IS_DEV: false,
}));

vi.mock("openapi-fetch", () => ({
  default: vi.fn(() => openApiClientMock),
}));

const { ApiClient } = await import("./client");

function createJwt(payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString("base64url");

  return `${encode(header)}.${encode(payload)}.signature`;
}

describe("ApiClient Authentication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    gotoMock.mockReset();
    appUserMock.user = null;
    appUserMock.failedLogin = false;

    openApiClientMock.GET.mockReset();
    openApiClientMock.POST.mockReset();
    openApiClientMock.PUT.mockReset();
    openApiClientMock.DELETE.mockReset();

    window.history.replaceState({}, "", "/dashboard");
  });

  it("successfully logs in and extracts user from JWT token", async () => {
    const token = createJwt({
      sub: "reader@example.com",
      roles: ["Admin", "Trusted"],
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(token, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient();
    const user = await client.login("reader@example.com", "secret");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/login?token=true",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(user).toEqual({
      email: "reader@example.com",
      roles: ["Admin", "Trusted"],
      tokenValidity: expect.any(Number),
    });
    expect(client.token).toBe(token);
  });

  it("redirects to login on 401 unauthorized responses", async () => {
    appUserMock.user = { email: "reader@example.com", roles: ["Trusted"] };
    openApiClientMock.GET.mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 401 }),
    });

    const client = new ApiClient();

    await expect(client.listProviders()).rejects.toThrow("Unauthorized");
    expect(appUserMock.user).toBeNull();
    expect(gotoMock).toHaveBeenCalledWith("/login");
  });

  it("rejects expired tokens returned during login", async () => {
    const expiredToken = createJwt({
      sub: "reader@example.com",
      roles: ["Trusted"],
      exp: Math.floor(Date.now() / 1000) - 10,
      iat: Math.floor(Date.now() / 1000) - 100,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(expiredToken, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient();

    await expect(client.login("reader@example.com", "secret")).rejects.toThrow(
      "Token expired",
    );
    expect(client.token).toBeNull();
    expect(openApiClientMock.GET).not.toHaveBeenCalled();
  });

  it("rejects tokens that are too close to expiry", async () => {
    const nearExpiryToken = createJwt({
      sub: "reader@example.com",
      roles: ["Trusted"],
      exp: Math.floor(Date.now() / 1000) + 30,
      iat: Math.floor(Date.now() / 1000),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(nearExpiryToken, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient();

    await expect(client.login("reader@example.com", "secret")).rejects.toThrow(
      "Token expired",
    );
    expect(client.token).toBeNull();
  });

  it("handles SSO redirect flow correctly", () => {
    const client = new ApiClient();

    client.redirectToSSO("keycloak");

    expect(window.location.href).toBe(
      "http://localhost:3000/auth/login?oidc_provider=keycloak",
    );
  });

  it("clears token on logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const client = new ApiClient();
    client.setFetch(fetchMock);
    client.token = "existing-token";

    await client.logout();

    expect(client.token).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/logout",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        redirect: "manual",
      }),
    );
  });

  it("clears token even when logout fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = new ApiClient();
    client.setFetch(fetchMock);
    client.token = "existing-token";

    await client.logout();

    expect(client.token).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Logout failed",
      expect.any(Error),
    );
  });

  it("handles login failure gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("nope", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient();

    await expect(client.login("reader@example.com", "wrong")).rejects.toThrow(
      "Login failed",
    );
    expect(client.token).toBeNull();
  });

  it("rejects malformed JWTs during login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-a-jwt", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient();

    await expect(client.login("reader@example.com", "secret")).rejects.toThrow(
      /Failed to decode JWT/,
    );
    expect(client.token).toBeNull();
  });

  it("retrieves token from SSO callback (retrieveToken)", async () => {
    const token = createJwt({
      sub: "reader@example.com",
      roles: ["Trusted"],
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(token, { status: 200 }),
    );
    const client = new ApiClient();
    client.setFetch(fetchMock);

    const user = await client.retrieveToken("ticket-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/token?trt=ticket-123",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
    expect(user).toEqual({
      email: "reader@example.com",
      roles: ["Trusted"],
      tokenValidity: expect.any(Number),
    });
    expect(client.token).toBe(token);
  });

  it("handles retrieveToken failure gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    const client = new ApiClient();
    client.setFetch(fetchMock);

    await expect(client.retrieveToken("ticket-123")).rejects.toThrow(
      "Login failed",
    );
    expect(client.token).toBeNull();
  });

  it("rejects malformed JWTs returned from retrieveToken", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not-a-jwt", { status: 200 }),
    );
    const client = new ApiClient();
    client.setFetch(fetchMock);

    await expect(client.retrieveToken("ticket-123")).rejects.toThrow(
      /Failed to decode JWT/,
    );
    expect(client.token).toBeNull();
  });
});

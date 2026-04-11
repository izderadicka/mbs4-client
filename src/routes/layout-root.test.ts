import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: {
    setFetch: vi.fn(),
    retrieveToken: vi.fn(),
  },
}));

vi.mock("$lib/api/client", () => ({
  apiClient: apiClientMock,
}));

vi.mock("$lib/dev.js", () => ({
  AUTOLOGIN: false,
}));

const { load } = await import("./+layout");

describe("routes/+layout load", () => {
  beforeEach(() => {
    apiClientMock.setFetch.mockReset();
    apiClientMock.retrieveToken.mockReset();
    localStorage.clear();
  });

  it("loads a valid stored user from localStorage", async () => {
    const user = {
      email: "reader@example.com",
      roles: ["Trusted"],
      tokenValidity: Date.now() + 10 * 60 * 1000,
    };
    const fetchMock = vi.fn();
    localStorage.setItem("user", JSON.stringify(user));

    const result = await load({
      url: new URL("http://localhost:3000/"),
      fetch: fetchMock as typeof fetch,
    });

    expect(apiClientMock.setFetch).toHaveBeenCalledWith(fetchMock);
    expect(apiClientMock.retrieveToken).not.toHaveBeenCalled();
    expect(result).toEqual({ user });
  });

  it("rejects a stale stored user", async () => {
    const staleUser = {
      email: "reader@example.com",
      roles: ["Trusted"],
      tokenValidity: Date.now() + 4 * 60 * 1000,
    };
    localStorage.setItem("user", JSON.stringify(staleUser));

    const result = await load({
      url: new URL("http://localhost:3000/"),
      fetch: vi.fn() as typeof fetch,
    });

    expect(apiClientMock.retrieveToken).not.toHaveBeenCalled();
    expect(result).toEqual({ user: null });
  });

  it("handles trt callback success and stores the retrieved user", async () => {
    const user = {
      email: "reader@example.com",
      roles: ["Admin", "Trusted"],
      tokenValidity: Date.now() + 60 * 60 * 1000,
    };
    apiClientMock.retrieveToken.mockResolvedValue(user);
    const fetchMock = vi.fn();

    const result = await load({
      url: new URL("http://localhost:3000/?trt=ticket-123"),
      fetch: fetchMock as typeof fetch,
    });

    expect(apiClientMock.setFetch).toHaveBeenCalledWith(fetchMock);
    expect(apiClientMock.retrieveToken).toHaveBeenCalledWith("ticket-123");
    expect(localStorage.getItem("user")).toBe(JSON.stringify(user));
    expect(result).toEqual({ user });
  });

  it("handles trt callback failure", async () => {
    apiClientMock.retrieveToken.mockRejectedValue(new Error("Login failed"));

    const result = await load({
      url: new URL("http://localhost:3000/?trt=ticket-123"),
      fetch: vi.fn() as typeof fetch,
    });

    expect(apiClientMock.retrieveToken).toHaveBeenCalledWith("ticket-123");
    expect(localStorage.getItem("user")).toBeNull();
    expect(result).toEqual({
      user: null,
      failedLogin: true,
    });
  });
});

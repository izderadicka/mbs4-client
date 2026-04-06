import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";

vi.mock("$lib/api/client", () => ({
  apiClient: {
    getLibraryStats: vi.fn().mockResolvedValue({
      totalEbooks: 12,
      totalSeries: 3,
      totalAuthors: 4,
    }),
    listEbooks: vi.fn().mockResolvedValue({
      rows: [{ id: 1, title: "Test Ebook" }],
    }),
    searchEbook: vi.fn().mockResolvedValue([]),
    loadIcon: vi.fn().mockResolvedValue(null),
  },
}));

const { default: Page } = await import("./(protected)/+page.svelte");

describe("/+page.svelte", () => {
  it("renders the protected home page widgets", async () => {
    render(Page);

    expect(
      await screen.findByRole("heading", { name: "Library Statistics" }),
    ).toBeTruthy();
    expect(
      await screen.findByRole("heading", { name: "Latest Ebooks" }),
    ).toBeTruthy();
    expect(await screen.findByText("12")).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Test Ebook" })).toBeTruthy();
  });
});

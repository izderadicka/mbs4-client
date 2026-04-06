import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";

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

    await expect
      .element(page.getByRole("heading", { name: "Library Statistics" }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("heading", { name: "Latest Ebooks" }))
      .toBeInTheDocument();
    await expect.element(page.getByText("12")).toBeInTheDocument();
    await expect
      .element(page.getByRole("link", { name: "Test Ebook" }))
      .toBeInTheDocument();
  });
});

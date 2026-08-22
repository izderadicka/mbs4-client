import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { Ebook } from "$lib/api";

vi.mock("svelte-sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("$lib/globals.svelte", () => ({
  hasRole: () => false,
}));

vi.mock("$lib/components/fragments/cover-image.svelte", async () => ({
  default: (await import("$lib/components/test-stubs/empty.svelte")).default,
}));

vi.mock("$lib/components/ui/table", async () => {
  const Wrapper = (
    await import("$lib/components/test-stubs/children-wrapper.svelte")
  ).default;

  return {
    Root: Wrapper,
    Body: Wrapper,
    Row: Wrapper,
    Head: Wrapper,
    Cell: Wrapper,
  };
});

const { default: DetailsTable } = await import("./details-table.svelte");

const ebook = {
  id: 1,
  title: "A book",
  language: { id: 1, name: "English", code: "en", version: 1 },
  genres: [],
  created: "2026-01-01",
  modified: "2026-01-02",
  version: 1,
} as unknown as Ebook;

function renderTable(userRating: number | null, hasReview = false) {
  return render(DetailsTable, {
    ebook,
    rating: null,
    ratingCount: null,
    userRating,
    onRate: vi.fn(),
    onDeleteRating: vi.fn(),
    hasReview,
    onEditReview: vi.fn(),
  });
}

function reviewButton() {
  return screen.getByRole("button", { name: /review/ });
}

describe("DetailsTable review button", () => {
  it("cannot be used before the ebook is rated", () => {
    renderTable(null);
    expect((reviewButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains itself on an element that still reacts to hover", () => {
    // a disabled button has pointer-events: none, so a title on the button
    // itself would never be shown
    renderTable(null);
    const hint = screen.getByTitle("Rate this ebook first to add a review");
    expect(hint.tagName).not.toBe("BUTTON");
    expect(hint.contains(reviewButton())).toBe(true);
  });

  it("is usable and unexplained once the ebook is rated", () => {
    renderTable(80);
    expect((reviewButton() as HTMLButtonElement).disabled).toBe(false);
    expect(
      screen.queryByTitle("Rate this ebook first to add a review"),
    ).toBeNull();
  });

  it("offers editing when a review already exists", () => {
    renderTable(80, true);
    expect(screen.getByRole("button", { name: "Edit review" })).toBeTruthy();
  });
});

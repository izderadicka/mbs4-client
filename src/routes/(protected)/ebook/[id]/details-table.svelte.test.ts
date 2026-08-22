import { fireEvent, render, screen } from "@testing-library/svelte";
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

function renderTable(onOpenReviews = vi.fn()) {
  return render(DetailsTable, {
    ebook,
    rating: 80,
    ratingCount: 3,
    userRating: null,
    onRate: vi.fn(),
    onDeleteRating: vi.fn(),
    onOpenReviews,
  });
}

describe("DetailsTable reviews link", () => {
  it("opens the reviews dialog on click", async () => {
    const onOpenReviews = vi.fn();
    renderTable(onOpenReviews);
    await fireEvent.click(screen.getByRole("button", { name: "Reviews" }));
    expect(onOpenReviews).toHaveBeenCalledOnce();
  });

  it("is always enabled, regardless of the caller's own rating", () => {
    renderTable();
    expect(
      (screen.getByRole("button", { name: "Reviews" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EbookRating, PagedEbookRating } from "$lib/api";

const toastError = vi.fn();
const listEbookRatings = vi.fn();

vi.mock("svelte-sonner", () => ({
  toast: { error: toastError },
}));

vi.mock("$lib/api/client", () => ({
  apiClient: { listEbookRatings },
}));

vi.mock("$lib/globals.svelte", () => ({
  appUser: { user: { email: "me@example.com" } },
}));

vi.mock("$lib/components/ui/dialog", async () => {
  const Root = (await import("$lib/components/test-stubs/dialog-wrapper.svelte"))
    .default;
  const Wrapper = (
    await import("$lib/components/test-stubs/children-wrapper.svelte")
  ).default;

  return {
    Root,
    Content: Wrapper,
    Header: Wrapper,
    Title: Wrapper,
    Description: Wrapper,
    Footer: Wrapper,
  };
});

vi.mock("$lib/components/ui/scroll-area", async () => {
  const Root = (
    await import("$lib/components/test-stubs/children-wrapper.svelte")
  ).default;
  const Scrollbar = (await import("$lib/components/test-stubs/empty.svelte"))
    .default;

  return {
    ScrollArea: Root,
    Scrollbar,
  };
});

const { default: RatingsDialog } = await import("./ratings-dialog.svelte");

function page(rows: EbookRating[], totalPages = 1): PagedEbookRating {
  return {
    page: 1,
    page_size: 20,
    total_pages: totalPages,
    total: rows.length,
    rows,
  };
}

function rating(overrides: Partial<EbookRating> = {}): EbookRating {
  return {
    id: 1,
    ebook_id: 1,
    rating: 80,
    description: null,
    version: 1,
    created_by: "other@example.com",
    created: "2026-01-01T00:00:00Z",
    modified: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function textarea() {
  return screen.getByLabelText("My review") as HTMLTextAreaElement;
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function renderDialog(props: Partial<Record<string, unknown>> = {}) {
  const rendered = render(RatingsDialog, {
    ebookId: 1,
    average: 80,
    count: 2,
    myRating: 80,
    myReview: null,
    onRate: vi.fn().mockResolvedValue(undefined),
    onDeleteRating: vi.fn().mockResolvedValue(undefined),
    onSaveReview: vi.fn().mockResolvedValue(undefined),
    ...props,
  });
  (rendered.component as unknown as { open: () => void }).open();
  await waitFor(() => expect(listEbookRatings).toHaveBeenCalled());
  return rendered;
}

describe("RatingsDialog", () => {
  beforeEach(() => {
    toastError.mockReset();
    listEbookRatings.mockReset();
  });

  it("fetches and renders other users' ratings, excluding my own", async () => {
    listEbookRatings.mockResolvedValue(
      page([
        rating({ id: 1, created_by: "other@example.com", description: "Great" }),
        rating({ id: 2, created_by: "me@example.com", description: "Mine" }),
      ]),
    );
    await renderDialog();
    expect(screen.getByText("other@example.com")).toBeTruthy();
    expect(screen.getByText("Great")).toBeTruthy();
    expect(screen.queryByText("me@example.com")).toBeNull();
    expect(screen.queryByText("Mine")).toBeNull();
  });

  it("shows an empty state when there are no other reviews", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    await renderDialog();
    expect(
      screen.getByText("No reviews from other readers yet."),
    ).toBeTruthy();
  });

  it("loads another page on demand", async () => {
    listEbookRatings.mockResolvedValueOnce(
      page([rating({ id: 1, created_by: "a@example.com" })], 2),
    );
    await renderDialog();
    expect(screen.getByText("a@example.com")).toBeTruthy();

    listEbookRatings.mockResolvedValueOnce(
      page([rating({ id: 2, created_by: "b@example.com" })], 2),
    );
    await fireEvent.click(button("Load more"));
    await waitFor(() => expect(screen.getByText("b@example.com")).toBeTruthy());
    expect(screen.getByText("a@example.com")).toBeTruthy();
  });

  it("toasts when the list fails to load", async () => {
    listEbookRatings.mockRejectedValue(new Error("nope"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderDialog();
    expect(toastError).toHaveBeenCalledWith("Failed to load reviews");
  });

  it("prefills my existing review", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    await renderDialog({ myReview: "Loved it" });
    expect(textarea().value).toBe("Loved it");
    expect(button("Remove review")).toBeTruthy();
  });

  it("disables saving before the ebook is rated", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    await renderDialog({ myRating: null, myReview: null });
    expect((button("Save") as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Rate the ebook above to add a written review."),
    ).toBeTruthy();
  });

  it("saves the trimmed review text", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    const onSaveReview = vi.fn().mockResolvedValue(undefined);
    await renderDialog({ onSaveReview });
    await fireEvent.input(textarea(), { target: { value: "  Great read  " } });
    await fireEvent.click(button("Save"));
    expect(onSaveReview).toHaveBeenCalledWith("Great read");
  });

  it("removes the review", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    const onSaveReview = vi.fn().mockResolvedValue(undefined);
    await renderDialog({ myReview: "Loved it", onSaveReview });
    await fireEvent.click(button("Remove review"));
    expect(onSaveReview).toHaveBeenCalledWith(null);
  });

  it("reports a failed review save", async () => {
    listEbookRatings.mockResolvedValue(page([]));
    const onSaveReview = vi.fn().mockRejectedValue(new Error("nope"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderDialog({ onSaveReview });
    await fireEvent.click(button("Save"));
    expect(toastError).toHaveBeenCalledWith("Failed to save review");
  });
});

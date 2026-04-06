import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { breadcrumb, events } from "$lib/globals.svelte";

const toastError = vi.fn();
const goto = vi.fn();
const addFileToEbook = vi.fn();
const metaToEbook = vi.fn();

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("$app/navigation", async () => {
  const actual = await vi.importActual<typeof import("$app/navigation")>(
    "$app/navigation",
  );
  return {
    ...actual,
    goto,
  };
});

vi.mock("./upload-form.svelte", async () => ({
  default: (await import("./test-stubs/upload-form.stub.svelte")).default,
}));

vi.mock("./waiting-meta.svelte", async () => ({
  default: (await import("./test-stubs/waiting-meta.stub.svelte")).default,
}));

vi.mock("./meta-card.svelte", async () => ({
  default: (await import("./test-stubs/meta-card.stub.svelte")).default,
}));

vi.mock("./search-card.svelte", async () => ({
  default: (await import("./test-stubs/search-card.stub.svelte")).default,
}));

vi.mock("./create-card.svelte", async () => ({
  default: (await import("./test-stubs/create-card.stub.svelte")).default,
}));

vi.mock("./logic", () => ({
  addFileToEbook,
  metaToEbook,
}));

const { default: UploadPage } = await import("./+page.svelte");

const metadata = {
  title: "The Tombs of Atuan",
  authors: ["Ursula Le Guin"],
  series: null,
  comments: "Desc",
  language: "en",
  genres: [],
  cover_file: null,
};

describe("upload/+page.svelte", () => {
  beforeEach(() => {
    breadcrumb.path = [];
    events.items = [];
    goto.mockReset();
    addFileToEbook.mockReset();
    metaToEbook.mockReset();
    toastError.mockReset();
  });

  it("moves from upload to metadata to create and assigns the uploaded file after create", async () => {
    addFileToEbook.mockResolvedValue({ id: 9 });
    metaToEbook.mockResolvedValue({ title: "Prefilled Ebook" });

    render(UploadPage);

    expect(screen.getByText("1. Upload")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Trigger Upload" }));

    expect(screen.getByText("2. Waiting for metadata")).toBeTruthy();
    expect(screen.getByText("Waiting Stub")).toBeTruthy();

    events.items = [
      {
        id: "evt-1",
        data: {
          data: {
            operation_id: 77,
            metadata,
          },
        },
      } as any,
    ];

    await waitFor(() => {
      expect(screen.getByText("3. Search existing ebooks")).toBeTruthy();
      expect(screen.getByText("Metadata: The Tombs of Atuan")).toBeTruthy();
    });

    await fireEvent.click(screen.getByRole("button", { name: "Create New Path" }));

    await waitFor(() => {
      expect(metaToEbook).toHaveBeenCalledWith(metadata);
      expect(screen.getByText("4. Create new ebook")).toBeTruthy();
    });

    await fireEvent.click(screen.getByRole("button", { name: "Finish Create" }));

    await waitFor(() => {
      expect(addFileToEbook).toHaveBeenCalledWith(
        55,
        {
          final_path: "uploads/book.epub",
          size: 123,
          hash: "abc123",
        },
        metadata,
      );
      expect(goto).toHaveBeenCalledWith("/ebook/55");
    });
  });

  it("assigns the uploaded file to an existing ebook from the search step", async () => {
    addFileToEbook.mockResolvedValue({ id: 10 });

    render(UploadPage);

    await fireEvent.click(screen.getByRole("button", { name: "Trigger Upload" }));

    events.items = [
      {
        id: "evt-2",
        data: {
          data: {
            operation_id: 77,
            metadata,
          },
        },
      } as any,
    ];

    await waitFor(() => {
      expect(screen.getByText("3. Search existing ebooks")).toBeTruthy();
    });

    await fireEvent.click(screen.getByRole("button", { name: "Choose Existing" }));

    await waitFor(() => {
      expect(addFileToEbook).toHaveBeenCalledWith(
        42,
        {
          final_path: "uploads/book.epub",
          size: 123,
          hash: "abc123",
        },
        metadata,
      );
      expect(goto).toHaveBeenCalledWith("/ebook/42");
    });
  });
});

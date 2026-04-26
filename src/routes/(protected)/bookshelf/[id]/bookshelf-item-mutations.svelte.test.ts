import { render } from "@testing-library/svelte";
import { writable } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addBookshelfItem = vi.fn();
const listBookshelves = vi.fn();
const updateBookshelfItem = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

type UpdateHandler = (input: {
  form: { valid: boolean; data: any };
  cancel?: () => void;
}) => Promise<void>;

const formHandlers: UpdateHandler[] = [];

vi.mock("sveltekit-superforms", () => ({
  superForm: vi.fn((initial: Record<string, unknown>, options: { onUpdate: UpdateHandler }) => {
    formHandlers.push(options.onUpdate);
    return {
      form: writable(structuredClone(initial)),
      enhance: () => ({
        destroy() {},
      }),
    };
  }),
}));

vi.mock("sveltekit-superforms/adapters", () => ({
  zod4Client: vi.fn((schema: unknown) => schema),
}));

vi.mock("$lib/api/client", () => ({
  apiClient: {
    addBookshelfItem,
    listBookshelves,
    updateBookshelfItem,
  },
}));

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("$lib/components/ui/form", async () => {
  const Wrapper = (await import("$lib/components/test-stubs/children-wrapper.svelte")).default;
  const Control = (await import("$lib/components/test-stubs/control-wrapper.svelte")).default;
  const Empty = (await import("$lib/components/test-stubs/empty.svelte")).default;

  return {
    Field: Wrapper,
    Control,
    Label: Wrapper,
    Description: Wrapper,
    FieldErrors: Empty,
  };
});

vi.mock("$lib/components/ui/dialog", async () => {
  const Root = (await import("$lib/components/test-stubs/dialog-wrapper.svelte")).default;
  const Wrapper = (await import("$lib/components/test-stubs/children-wrapper.svelte")).default;

  return {
    Root,
    Content: Wrapper,
    Header: Wrapper,
    Title: Wrapper,
    Description: Wrapper,
    Footer: Wrapper,
  };
});

vi.mock("$lib/components/ui/select", async () => {
  const Root = (await import("$lib/components/test-stubs/select-root.stub.svelte")).default;
  const Trigger = (await import("$lib/components/test-stubs/select-trigger.stub.svelte")).default;
  const Wrapper = (await import("$lib/components/test-stubs/children-wrapper.svelte")).default;

  return {
    Root,
    Trigger,
    Content: Wrapper,
    Item: Wrapper,
  };
});

vi.mock("$lib/components/ui/button/button.svelte", async () => ({
  default: (await import("$lib/components/test-stubs/text-button.stub.svelte")).default,
}));

const { default: AddToBookshelfDialog } = await import("$lib/components/add-to-bookshelf-dialog.svelte");
const { default: EditItemDialog } = await import("./edit-item-dialog.svelte");

async function submitLatestForm(data: Record<string, unknown>) {
  const handler = formHandlers.at(-1);
  if (!handler) {
    throw new Error("Missing form handler");
  }
  await handler({
    form: {
      valid: true,
      data,
    },
    cancel: vi.fn(),
  });
}

describe("bookshelf item mutations", () => {
  beforeEach(() => {
    formHandlers.length = 0;
    localStorage.clear();
    addBookshelfItem.mockReset();
    listBookshelves.mockReset();
    updateBookshelfItem.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it("loads bookshelves on open and submits the add-item payload", async () => {
    listBookshelves.mockResolvedValue({
      rows: [
        { id: 5, name: "Favorites" },
        { id: 9, name: "Sci-Fi" },
      ],
    });
    addBookshelfItem.mockResolvedValue({ id: 101 });
    localStorage.setItem("mbs4.last-bookshelf-id", "9");

    const { component } = render(AddToBookshelfDialog, {
      title: "Dune",
      ebookId: 77,
      itemType: "EBOOK",
    });

    await component.open();

    expect(listBookshelves).toHaveBeenCalledWith(false, {
      page: 1,
      page_size: 100,
      sort: expect.anything(),
    });

    await submitLatestForm({
      bookshelf_id: 9,
      note: "  reread soon  ",
      order: 3,
    });

    expect(addBookshelfItem).toHaveBeenCalledWith(9, {
      item_type: "EBOOK",
      note: "reread soon",
      order: 3,
      ebook_id: 77,
      series_id: undefined,
    });
    expect(toastSuccess).toHaveBeenCalledWith('Added "Dune" to bookshelf');
  });

  it("opens with an item and submits the edit-item payload with version", async () => {
    updateBookshelfItem.mockResolvedValue({ id: 41 });
    const onUpdated = vi.fn();

    const { component } = render(EditItemDialog, {
      bookshelfId: 12,
      onUpdated,
    });

    const item = {
      id: 41,
      version: 6,
      title: "Dune Messiah",
      note: "old note",
      order: 7,
    };

    component.openDialog(item as any);

    await submitLatestForm({
      note: "  updated note  ",
      order: 2,
    });

    expect(updateBookshelfItem).toHaveBeenCalledWith(12, {
      id: 41,
      version: 6,
      note: "updated note",
      order: 2,
    });
    expect(onUpdated).toHaveBeenCalledWith(item, "updated note");
    expect(toastSuccess).toHaveBeenCalledWith("Bookshelf item updated");
  });
});

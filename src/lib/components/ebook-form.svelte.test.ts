import { fireEvent, render, screen } from "@testing-library/svelte";
import { writable } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createEbook = vi.fn();
const updateEbook = vi.fn();
const deleteEbook = vi.fn();
const toastError = vi.fn();

let latestOnUpdate:
  | ((input: {
      form: { valid: boolean; data: any };
      cancel: () => void;
    }) => Promise<void>)
  | undefined;

vi.mock("sveltekit-superforms/client", () => ({
  defaults: vi.fn((value?: unknown) => value ?? {}),
  superForm: vi.fn((initial: Record<string, unknown>, options: { onUpdate: typeof latestOnUpdate }) => {
    latestOnUpdate = options.onUpdate;
    const form = writable(structuredClone(initial));

    return {
      form,
      enhance: () => ({
        destroy() {},
      }),
    };
  }),
}));

vi.mock("sveltekit-superforms/adapters", () => ({
  zod4: vi.fn((schema: unknown) => schema),
  zod4Client: vi.fn((schema: unknown) => schema),
}));

vi.mock("$lib/api/client", () => ({
  apiClient: {
    createEbook,
    updateEbook,
    deleteEbook,
  },
}));

vi.mock("svelte-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

vi.mock("$lib/components/ui/form", async () => {
  const Wrapper = (await import("./test-stubs/children-wrapper.svelte")).default;
  const Control = (await import("./test-stubs/control-wrapper.svelte")).default;
  const Empty = (await import("./test-stubs/empty.svelte")).default;

  return {
    Field: Wrapper,
    Control,
    Label: Wrapper,
    Description: Wrapper,
    FieldErrors: Empty,
  };
});

vi.mock("$lib/components/fields/series-field.svelte", async () => ({
  default: (await import("./test-stubs/bound-value-field.svelte")).default,
}));

vi.mock("$lib/components/fields/language-field.svelte", async () => ({
  default: (await import("./test-stubs/bound-value-field.svelte")).default,
}));

vi.mock("$lib/components/fields/genre-field.svelte", async () => ({
  default: (await import("./test-stubs/bound-value-field.svelte")).default,
}));

vi.mock("$lib/components/fields/author-field.svelte", async () => ({
  default: (await import("./test-stubs/bound-value-field.svelte")).default,
}));

vi.mock("$lib/components/fragments/form-buttons.svelte", async () => ({
  default: (await import("./test-stubs/form-buttons.stub.svelte")).default,
}));

vi.mock("$lib/components/delete-dialog.svelte", async () => ({
  default: (await import("./test-stubs/delete-dialog.stub.svelte")).default,
}));

const { default: EbookForm } = await import("./ebook-form.svelte");

function createFormData(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: null,
    version: 1,
    title: "The Left Hand of Darkness",
    authors: [{ id: 10, name: "Ursula K. Le Guin" }],
    series: { id: 20, title: "Hainish Cycle" },
    series_index: "4",
    description: "A classic science fiction novel.",
    language: { id: 30, name: "English" },
    genres: [{ id: 40, name: "Science Fiction" }],
    ...overrides,
  };
}

async function submitFormUpdate(data: Record<string, any>) {
  const cancel = vi.fn();
  await latestOnUpdate?.({
    form: {
      valid: true,
      data,
    },
    cancel,
  });
  return cancel;
}

describe("ebook-form.svelte", () => {
  beforeEach(() => {
    latestOnUpdate = undefined;
    createEbook.mockReset();
    updateEbook.mockReset();
    deleteEbook.mockReset();
    toastError.mockReset();
  });

  it("creates an ebook with the mapped API payload", async () => {
    const formData = createFormData();
    const createdEbook = { id: 99, title: formData.title };
    const afterCreate = vi.fn();

    createEbook.mockResolvedValue(createdEbook);

    render(EbookForm, {
      ebookData: formData,
      afterCreate,
      onCancel: vi.fn(),
    });

    const cancel = await submitFormUpdate(formData);

    expect(createEbook).toHaveBeenCalledWith({
      title: "The Left Hand of Darkness",
      authors: [10],
      series_id: 20,
      series_index: "4",
      description: "A classic science fiction novel.",
      language_id: 30,
      genres: [40],
    });
    expect(afterCreate).toHaveBeenCalledWith(createdEbook);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("updates an ebook with id and version preserved", async () => {
    const formData = createFormData({
      id: 7,
      version: 3,
      title: "The Dispossessed",
    });
    const updatedEbook = { id: 7, title: formData.title };
    const afterUpdate = vi.fn();

    updateEbook.mockResolvedValue(updatedEbook);

    render(EbookForm, {
      ebookData: formData,
      afterUpdate,
      onCancel: vi.fn(),
    });

    const cancel = await submitFormUpdate(formData);

    expect(updateEbook).toHaveBeenCalledWith({
      id: 7,
      version: 3,
      title: "The Dispossessed",
      authors: [10],
      series_id: 20,
      series_index: "4",
      description: "A classic science fiction novel.",
      language_id: 30,
      genres: [40],
    });
    expect(afterUpdate).toHaveBeenCalledWith(updatedEbook);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("deletes an ebook after confirmation", async () => {
    const afterDelete = vi.fn();
    const formData = createFormData({
      id: 11,
      title: "A Wizard of Earthsea",
    });

    deleteEbook.mockResolvedValue(undefined);

    render(EbookForm, {
      ebookData: formData,
      afterDelete,
      onCancel: vi.fn(),
    });

    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    expect(deleteEbook).toHaveBeenCalledWith(11);
    expect(afterDelete).toHaveBeenCalledWith(11);
  });
});

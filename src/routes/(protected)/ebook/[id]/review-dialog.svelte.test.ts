import { fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();

vi.mock("svelte-sonner", () => ({
  toast: { error: toastError },
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

const { default: ReviewDialog } = await import("./review-dialog.svelte");

function textarea() {
  return screen.getByLabelText("My review") as HTMLTextAreaElement;
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function renderDialog(
  onSave: (text: string | null) => Promise<void>,
  initialText: string | null = null,
) {
  const rendered = render(ReviewDialog, { onSave });
  (rendered.component as unknown as { open: (t: string | null) => void }).open(
    initialText,
  );
  await tick();
  return rendered;
}

describe("ReviewDialog", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("shows the existing review text when opened", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderDialog(onSave, "Loved it");
    expect(textarea().value).toBe("Loved it");
    expect(button("Remove review")).toBeTruthy();
  });

  it("has no remove option when there is no review yet", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderDialog(onSave, null);
    expect(textarea().value).toBe("");
    expect(screen.queryByRole("button", { name: "Remove review" })).toBeNull();
  });

  it("saves the trimmed text", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderDialog(onSave, null);
    await fireEvent.input(textarea(), { target: { value: "  Great read  " } });
    await fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith("Great read");
  });

  it("saves whitespace-only text as no review", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderDialog(onSave, "Loved it");
    await fireEvent.input(textarea(), { target: { value: "   " } });
    await fireEvent.click(button("Save"));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("removes the review", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await renderDialog(onSave, "Loved it");
    await fireEvent.click(button("Remove review"));
    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("reports a failed save and keeps the text", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("nope"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderDialog(onSave, "Loved it");
    await fireEvent.click(button("Save"));
    expect(toastError).toHaveBeenCalledWith("Failed to save review");
    expect(textarea().value).toBe("Loved it");
  });
});

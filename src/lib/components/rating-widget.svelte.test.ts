import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("svelte-sonner", () => ({
  toast: { error: toastError },
}));

const { default: RatingWidget } = await import("./rating-widget.svelte");

function stubRect(el: Element, left = 100, width = 20) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left,
    right: left + width,
    top: 0,
    bottom: width,
    width,
    height: width,
    x: left,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function rateButtons() {
  return Array.from({ length: 5 }, (_, i) =>
    screen.getByRole("button", { name: `Rate ${i + 1} stars` }),
  );
}

describe("RatingWidget", () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it("view mode renders count and no rate buttons", () => {
    render(RatingWidget, { rating: 60, count: 7, mode: "view" });
    expect(screen.getByText("(7)")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("view mode shows (0) when count is null", () => {
    render(RatingWidget, { rating: null, count: null, mode: "view" });
    expect(screen.getByText("(0)")).toBeTruthy();
  });

  it("clicking right half of star i calls onRate with (i+1)*20", async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    render(RatingWidget, { rating: null, mode: "interactive", userRating: null, onRate });

    const buttons = rateButtons();
    stubRect(buttons[2]);
    await fireEvent.click(buttons[2], { clientX: 115 });

    expect(onRate).toHaveBeenCalledWith(60);
  });

  it("clicking left half of star i calls onRate with i*20+10", async () => {
    const onRate = vi.fn().mockResolvedValue(undefined);
    render(RatingWidget, { rating: null, mode: "interactive", userRating: null, onRate });

    const buttons = rateButtons();
    stubRect(buttons[2]);
    await fireEvent.click(buttons[2], { clientX: 105 });

    expect(onRate).toHaveBeenCalledWith(50);
  });

  it("toasts and stays enabled when onRate rejects", async () => {
    const onRate = vi.fn().mockRejectedValue(new Error("boom"));
    render(RatingWidget, { rating: null, mode: "interactive", userRating: null, onRate });

    const buttons = rateButtons();
    stubRect(buttons[0]);
    await fireEvent.click(buttons[0], { clientX: 115 });

    expect(onRate).toHaveBeenCalledWith(20);
    expect(toastError).toHaveBeenCalledWith("Failed to set rating");
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
  });

  it("hides the clear button when userRating is null", () => {
    render(RatingWidget, {
      rating: 40,
      mode: "interactive",
      userRating: null,
      onRate: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(screen.queryByRole("button", { name: "Clear my rating" })).toBeNull();
  });

  it("clear button calls onDelete when userRating is set", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(RatingWidget, {
      rating: 40,
      mode: "interactive",
      userRating: 40,
      onRate: vi.fn(),
      onDelete,
    });

    await fireEvent.click(screen.getByRole("button", { name: "Clear my rating" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("toasts when onDelete rejects", async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error("boom"));
    render(RatingWidget, {
      rating: 40,
      mode: "interactive",
      userRating: 40,
      onRate: vi.fn(),
      onDelete,
    });

    await fireEvent.click(screen.getByRole("button", { name: "Clear my rating" }));
    expect(toastError).toHaveBeenCalledWith("Failed to clear rating");
  });
});

import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import DescriptionBlock, {
  COLLAPSE_THRESHOLD,
} from "./description-block.svelte";

const longText = "x".repeat(COLLAPSE_THRESHOLD + 1);

describe("DescriptionBlock", () => {
  it("renders the trimmed text", () => {
    render(DescriptionBlock, { text: "  A tale of two cities  " });
    expect(screen.getByText("A tale of two cities")).toBeTruthy();
  });

  it("renders nothing for blank text", () => {
    const { container } = render(DescriptionBlock, { text: "   \n " });
    expect(container.textContent?.trim()).toBe("");
  });

  it("renders nothing when text is missing", () => {
    const { container } = render(DescriptionBlock, { text: null });
    expect(container.textContent?.trim()).toBe("");
  });

  it("shows the label when given", () => {
    render(DescriptionBlock, { text: "Some prose", label: "Description" });
    expect(screen.getByText("Description")).toBeTruthy();
  });

  it("does not offer expansion for short text", () => {
    render(DescriptionBlock, { text: "Short enough" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("clamps long text and toggles on demand", async () => {
    render(DescriptionBlock, { text: longText });
    const paragraph = screen.getByText(longText);
    expect(paragraph.className).toContain("line-clamp-6");

    const button = screen.getByRole("button", { name: "Show more" });
    await fireEvent.click(button);
    expect(paragraph.className).not.toContain("line-clamp-6");
    expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(paragraph.className).toContain("line-clamp-6");
  });
});

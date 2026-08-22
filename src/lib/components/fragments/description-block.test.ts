import { describe, expect, it } from "vitest";
import { COLLAPSE_THRESHOLD, isBlank } from "./description-block.svelte";

describe("isBlank", () => {
  it("treats missing text as blank", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });

  it("treats empty and whitespace-only text as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("  \n\t ")).toBe(true);
  });

  it("treats real text as not blank", () => {
    expect(isBlank("A book about books")).toBe(false);
    expect(isBlank("  padded  ")).toBe(false);
  });
});

describe("COLLAPSE_THRESHOLD", () => {
  it("is a positive character count", () => {
    expect(COLLAPSE_THRESHOLD).toBeGreaterThan(0);
  });
});

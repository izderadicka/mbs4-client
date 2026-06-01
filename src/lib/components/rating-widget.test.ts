import { describe, expect, it } from "vitest";
import { starFill } from "./rating-widget.svelte";

describe("starFill", () => {
  it("returns 'empty' for null/undefined", () => {
    for (let i = 0; i < 5; i++) {
      expect(starFill(null, i)).toBe("empty");
      expect(starFill(undefined, i)).toBe("empty");
    }
  });

  it("returns all empty at 0", () => {
    for (let i = 0; i < 5; i++) {
      expect(starFill(0, i)).toBe("empty");
    }
  });

  it("returns all full at 100", () => {
    for (let i = 0; i < 5; i++) {
      expect(starFill(100, i)).toBe("full");
    }
  });

  it("treats first star half at 10 and full at 20", () => {
    expect(starFill(9, 0)).toBe("empty");
    expect(starFill(10, 0)).toBe("half");
    expect(starFill(19, 0)).toBe("half");
    expect(starFill(20, 0)).toBe("full");
  });

  it("maps 50 to 2 full stars and a half on the third", () => {
    expect(starFill(50, 0)).toBe("full");
    expect(starFill(50, 1)).toBe("full");
    expect(starFill(50, 2)).toBe("half");
    expect(starFill(50, 3)).toBe("empty");
    expect(starFill(50, 4)).toBe("empty");
  });

  it("maps 75 to 3 full + 1 half", () => {
    expect(starFill(75, 0)).toBe("full");
    expect(starFill(75, 1)).toBe("full");
    expect(starFill(75, 2)).toBe("full");
    expect(starFill(75, 3)).toBe("half");
    expect(starFill(75, 4)).toBe("empty");
  });

  it("maps fractional averages around thresholds", () => {
    expect(starFill(29.999, 1)).toBe("empty");
    expect(starFill(30, 1)).toBe("half");
    expect(starFill(39.999, 1)).toBe("half");
    expect(starFill(40, 1)).toBe("full");
  });
});

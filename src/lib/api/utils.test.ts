import { beforeEach, describe, expect, it } from "vitest";
import { getListingParams } from "./utils";

const STORAGE_KEY = "mbs4.settings";

describe("getListingParams", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses page_size URL param when present", () => {
    const url = new URL("http://localhost/ebook?page_size=25&page=2");
    const params = getListingParams(url);
    expect(params.page_size).toBe(25);
    expect(params.page).toBe(2);
  });

  it("falls back to stored page size when no URL param", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageSize: 50 }));
    const params = getListingParams(new URL("http://localhost/ebook"));
    expect(params.page_size).toBe(50);
  });

  it("uses DEFAULT_PAGE_SIZE when no URL param and no stored setting", () => {
    const params = getListingParams(new URL("http://localhost/ebook"));
    expect(params.page_size).toBe(10);
  });

  it("URL param wins over stored setting", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageSize: 50 }));
    const params = getListingParams(new URL("http://localhost/ebook?page_size=25"));
    expect(params.page_size).toBe(25);
  });

  it("ignores invalid stored page size and falls back to default", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pageSize: 999 }));
    const params = getListingParams(new URL("http://localhost/ebook"));
    expect(params.page_size).toBe(10);
  });

  it("defaults page to 1 when not in URL", () => {
    const params = getListingParams(new URL("http://localhost/ebook"));
    expect(params.page).toBe(1);
  });

  it("reads sort from URL", () => {
    const params = getListingParams(new URL("http://localhost/ebook?sort=title"));
    expect(params.sort).toBe("title");
  });

  it("returns undefined sort when not in URL", () => {
    const params = getListingParams(new URL("http://localhost/ebook"));
    expect(params.sort).toBeUndefined();
  });
});

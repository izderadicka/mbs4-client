import { describe, expect, it } from "vitest";
import { buildOnlineSearchUrl, formatName } from "./utils";

describe("buildOnlineSearchUrl", () => {
  const TEMPLATE_ALL =
    "https://example.com/?t={title}&s={series}&a={author}&af={author_first}&al={author_last}";

  it("substitutes all placeholders for a single-author ebook", () => {
    const url = buildOnlineSearchUrl(TEMPLATE_ALL, {
      title: "Hobbit",
      series: { title: "Middle-earth" },
      authors: [{ first_name: "J.R.R.", last_name: "Tolkien" }],
    });
    expect(url).toBe(
      "https://example.com/?t=Hobbit&s=Middle-earth&a=J.R.R.%20Tolkien&af=J.R.R.&al=Tolkien",
    );
  });

  it("leaves all author placeholders empty when ebook has multiple authors", () => {
    const url = buildOnlineSearchUrl(TEMPLATE_ALL, {
      title: "Co-Written",
      series: null,
      authors: [
        { first_name: "Alice", last_name: "A" },
        { first_name: "Bob", last_name: "B" },
      ],
    });
    expect(url).toBe("https://example.com/?t=Co-Written&s=&a=&af=&al=");
  });

  it("leaves all author placeholders empty when authors is undefined", () => {
    const url = buildOnlineSearchUrl(TEMPLATE_ALL, {
      title: "Untitled",
    });
    expect(url).toBe("https://example.com/?t=Untitled&s=&a=&af=&al=");
  });

  it("uses surname only when first_name is missing", () => {
    const url = buildOnlineSearchUrl(TEMPLATE_ALL, {
      title: "Mononym",
      authors: [{ last_name: "Homer" }],
    });
    expect(url).toBe(
      "https://example.com/?t=Mononym&s=&a=Homer&af=&al=Homer",
    );
  });

  it("leaves {series} empty when ebook has no series", () => {
    const url = buildOnlineSearchUrl("https://x/?s={series}&t={title}", {
      title: "Standalone",
      authors: [{ first_name: "X", last_name: "Y" }],
    });
    expect(url).toBe("https://x/?s=&t=Standalone");
  });

  it("percent-encodes Czech / accented characters", () => {
    const url = buildOnlineSearchUrl(
      "https://www.databazeknih.cz/vyhledavani/knihy?q={title}",
      { title: "Dlouhý Páté přikázání" },
    );
    expect(url).toBe(
      "https://www.databazeknih.cz/vyhledavani/knihy?q=Dlouh%C3%BD%20P%C3%A1t%C3%A9%20p%C5%99ik%C3%A1z%C3%A1n%C3%AD",
    );
  });

  it("returns the template unchanged when it has no placeholders", () => {
    const url = buildOnlineSearchUrl("https://example.com/", {
      title: "T",
      authors: [{ first_name: "A", last_name: "B" }],
    });
    expect(url).toBe("https://example.com/");
  });

  it("does not corrupt {author_first}/{author_last} when also expanding {author}", () => {
    const url = buildOnlineSearchUrl(
      "{author}|{author_first}|{author_last}",
      { title: "T", authors: [{ first_name: "Jane", last_name: "Doe" }] },
    );
    expect(url).toBe("Jane%20Doe|Jane|Doe");
  });
});

describe("formatName", () => {
  it("joins first and last name", () => {
    expect(formatName({ first_name: "Jane", last_name: "Doe" })).toBe(
      "Jane Doe",
    );
  });

  it("returns only last name when first is missing", () => {
    expect(formatName({ last_name: "Homer" })).toBe("Homer");
  });
});

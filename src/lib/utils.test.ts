import { describe, expect, it } from "vitest";
import { buildOnlineSearchUrl, formatName, stripHtml } from "./utils";

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

describe("stripHtml", () => {
  it("returns empty string for missing text", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });

  it("leaves plain text untouched", () => {
    const text = "First line\n\nSecond line with a < b & c > d";
    expect(stripHtml(text)).toBe(text);
  });

  it("decodes entities in text without tags", () => {
    expect(stripHtml("Tom &amp; Jerry\n&bdquo;Hi&ldquo;")).toBe(
      "Tom & Jerry\n„Hi“",
    );
  });

  it("keeps table cells apart", () => {
    expect(
      stripHtml("<table><tr><td>Year</td><td>1933</td></tr></table>"),
    ).toBe("Year\n1933");
  });

  it("removes tags and keeps text", () => {
    expect(
      stripHtml(
        '<div><p style="color: red"><span>Hello</span> <b>world</b></p></div>',
      ),
    ).toBe("Hello world");
  });

  it("turns block boundaries and br into line breaks", () => {
    expect(stripHtml("<p>One</p><p>Two<br/>Three</p>")).toBe("One\nTwo\nThree");
  });

  it("collapses source whitespace", () => {
    expect(stripHtml("<p>Some\n   wrapped\ttext</p>")).toBe(
      "Some wrapped text",
    );
  });

  it("decodes entities", () => {
    expect(
      stripHtml("<p>Tom &amp; Jerry&nbsp;&#8211; &quot;x&quot; &#x2026;</p>"),
    ).toBe('Tom & Jerry – "x" …');
  });

  it("drops comments, scripts and styles", () => {
    expect(
      stripHtml(
        "<p>A<!-- hidden --></p><style>p{}</style><script>x()</script>B",
      ),
    ).toBe("A\nB");
  });

  it("handles a real-world scraped description", () => {
    const html =
      '<div><p id="bdetdesc" class="justify" style="padding: 0px;"><span class="start_text">Představte si, že ve vaší rodné zemi. Ale jednoho dne její t</span><span class="end_text" style="display: inline;">atínek zmizí…</span><a id="346124" href="https://www.databazeknih.cz/"></a></p><div class="clear_right" style="clear: left;"></div><br class="Apple-interchange-newline"></div>';
    expect(stripHtml(html)).toBe(
      "Představte si, že ve vaší rodné zemi. Ale jednoho dne její tatínek zmizí…",
    );
  });
});

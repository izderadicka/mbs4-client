import { describe, expect, it, vi } from "vitest";
import type { FoliateView } from "foliate-js/view.js";
import { SentenceSource, segmentDocumentSentences } from "./sentences";

function parseDoc(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${bodyHtml}</body></html>`,
    "text/html",
  );
}

// NOTE: happy-dom's Range implementation is unreliable for DOMParser
// documents (boundaries get corrupted, toString() is empty), so range
// boundary fidelity is asserted in sentences.browser.test.ts against a real
// browser; here only sentence texts and cursor logic are covered.

describe("segmentDocumentSentences", () => {
  it("splits paragraphs into ordered sentences with matching ranges", () => {
    const doc = parseDoc(
      "<p>Hello world. Second sentence here!</p><p>Another paragraph?</p>",
    );
    const result = segmentDocumentSentences(doc, "en");
    expect(result.map((s) => s.text)).toEqual([
      "Hello world.",
      "Second sentence here!",
      "Another paragraph?",
    ]);
  });

  it("handles sentences spanning inline markup", () => {
    const doc = parseDoc("<p>This is <b>bold and</b> important. Short one.</p>");
    const result = segmentDocumentSentences(doc, "en");
    expect(result.map((s) => s.text)).toEqual([
      "This is bold and important.",
      "Short one.",
    ]);
  });

  it("returns nothing for whitespace-only documents", () => {
    const doc = parseDoc("<p>   </p><div>\n\t</div>");
    expect(segmentDocumentSentences(doc, "en")).toEqual([]);
  });

  it("ignores script and style content", () => {
    const doc = parseDoc(
      "<p>Visible text.</p><script>var x = 'hidden. code.';</script>",
    );
    const result = segmentDocumentSentences(doc, "en");
    expect(result.map((s) => s.text)).toEqual(["Visible text."]);
  });
});

// Stub foliate view: sections with fake docs; getCFI encodes (section,
// ordinal, length) as a well-formed range CFI so that the real epubcfi
// compare orders sentences correctly.
function makeStubView(
  sections: { html?: string; linear?: string }[],
): FoliateView {
  const counters = new Map<number, number>();
  const createDocSpies: ReturnType<typeof vi.fn>[] = [];
  const view = {
    book: {
      metadata: { language: "en" },
      sections: sections.map((s, i) => {
        if (s.html === undefined) return { linear: s.linear };
        const spy = vi.fn(async () => parseDoc(s.html!));
        createDocSpies[i] = spy;
        return { linear: s.linear, createDocument: spy };
      }),
    },
    getCFI(index: number) {
      // fake range CFI for the n-th sentence of the section: start inside
      // element 2(n+1), end just before the next element - offset-free, so
      // it doesn't depend on happy-dom Range fidelity
      const n = counters.get(index) ?? 0;
      counters.set(index, n + 1);
      return `epubcfi(/6/${(index + 1) * 2}!/4,/${(n + 1) * 2}/1:0,/${(n + 1) * 2 + 1})`;
    },
    resolveCFI(cfi: string) {
      const m = cfi.match(/\/6\/(\d+)!/);
      if (!m) throw new Error("bad cfi");
      return { index: parseInt(m[1]) / 2 - 1, anchor: () => null as never };
    },
  } as unknown as FoliateView;
  return Object.assign(view, { createDocSpies });
}

// point CFI inside a section: ordinal = sentence element ordinal (0-based)
const pointCfi = (section: number, ordinal: number, offset = 0) =>
  `epubcfi(/6/${(section + 1) * 2}!/4/${(ordinal + 1) * 2}/1:${offset})`;

describe("SentenceSource", () => {
  const THREE_SECTIONS = [
    { html: "<p>One one. Two two. Three three.</p>" },
    { html: "<p>Notes here.</p>", linear: "no" },
    { html: "" }, // empty section
    { html: "<p>Four four. Five five.</p>" },
  ];

  it("iterates forward across sections, skipping non-linear and empty ones", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    const cursor = (await source.sentenceAt(pointCfi(0, 0)))!;
    expect(cursor.current.text).toBe("One one.");
    expect((await cursor.next())!.text).toBe("Two two.");
    expect((await cursor.next())!.text).toBe("Three three.");
    const crossed = await cursor.next();
    expect(crossed!.text).toBe("Four four.");
    expect(crossed!.sectionIndex).toBe(3);
    expect((await cursor.next())!.text).toBe("Five five.");
    expect(await cursor.next()).toBeNull();
    // cursor stays on the last sentence after hitting the end
    expect(cursor.current.text).toBe("Five five.");
  });

  it("iterates backward across sections", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    const cursor = (await source.sentenceAt(pointCfi(3, 0)))!;
    expect(cursor.current.text).toBe("Four four.");
    const crossed = await cursor.prev();
    expect(crossed!.text).toBe("Three three.");
    expect(crossed!.sectionIndex).toBe(0);
    await cursor.prev();
    expect((await cursor.prev())!.text).toBe("One one.");
    expect(await cursor.prev()).toBeNull();
    expect(cursor.current.text).toBe("One one.");
  });

  it("finds the sentence containing a position", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    // point inside the second sentence element (ordinal 1)
    const cursor = (await source.sentenceAt(pointCfi(0, 1, 3)))!;
    expect(cursor.current.text).toBe("Two two.");
  });

  it("moves to the next section when position is past the last sentence", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    const cursor = (await source.sentenceAt(pointCfi(0, 9)))!;
    expect(cursor.current.text).toBe("Four four.");
    expect(cursor.current.sectionIndex).toBe(3);
  });

  it("starts from the beginning for an unparseable CFI", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    const cursor = (await source.sentenceAt("garbage"))!;
    expect(cursor.current.text).toBe("One one.");
  });

  it("returns null when the book has no readable text", async () => {
    const source = new SentenceSource(
      makeStubView([{}, {}]), // sections without createDocument (e.g. CBZ)
    );
    expect(await source.sentenceAt(pointCfi(0, 0))).toBeNull();
  });

  it("tags sentences with the book file language by default", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS));
    const cursor = (await source.sentenceAt(pointCfi(0, 0)))!;
    expect(cursor.current.lang).toBe("en");
  });

  it("prefers the language given by the application", async () => {
    const source = new SentenceSource(makeStubView(THREE_SECTIONS), "cs");
    const cursor = (await source.sentenceAt(pointCfi(0, 0)))!;
    expect(cursor.current.lang).toBe("cs");
  });

  it("caches section segmentation", async () => {
    const view = makeStubView(THREE_SECTIONS);
    const source = new SentenceSource(view);
    const cursor = (await source.sentenceAt(pointCfi(0, 0)))!;
    await cursor.next();
    await cursor.next();
    await source.sentenceAt(pointCfi(0, 1));
    const spies = (view as unknown as { createDocSpies: ReturnType<typeof vi.fn>[] })
      .createDocSpies;
    expect(spies[0]).toHaveBeenCalledTimes(1);
  });
});

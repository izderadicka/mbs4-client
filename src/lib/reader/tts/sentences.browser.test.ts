// Range boundary fidelity of sentence segmentation, in a real browser
// (happy-dom's Range over DOMParser documents is unreliable, see
// sentences.test.ts).
import { describe, expect, it } from "vitest";
import { segmentDocumentSentences } from "./sentences";

function parseDoc(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<html><body>${bodyHtml}</body></html>`,
    "text/html",
  );
}

describe("segmentDocumentSentences ranges (browser)", () => {
  it("produces ranges that exactly cover each sentence", () => {
    const doc = parseDoc(
      "<p>Hello world. Second sentence here!</p><p>Another paragraph?</p>",
    );
    const result = segmentDocumentSentences(doc, "en");
    expect(result.map((s) => s.text)).toEqual([
      "Hello world.",
      "Second sentence here!",
      "Another paragraph?",
    ]);
    for (const { text, range } of result) {
      expect(range.toString()).toBe(text);
    }
  });

  it("covers sentences spanning inline markup", () => {
    const doc = parseDoc(
      "<p>This is <b>bold and</b> important. Short one.</p>",
    );
    const result = segmentDocumentSentences(doc, "en");
    expect(result[0].range.toString()).toBe("This is bold and important.");
    expect(result[1].range.toString()).toBe("Short one.");
  });
});

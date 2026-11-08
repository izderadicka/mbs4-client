// Sentence iteration over a foliate-js book, for read-aloud.
//
// Sentences are addressed by CFI (stable across relayout); DOM Ranges are
// created only transiently while segmenting a section document and are never
// stored. Section documents are loaded without rendering via
// section.createDocument(), so sentences can be prefetched beyond the
// currently displayed section. Sections lacking createDocument (image-only
// formats like CBZ) yield no sentences and are skipped.

import { collapse, compare } from "foliate-js/epubcfi.js";
import type { FoliateBook, FoliateView } from "foliate-js/view.js";

export interface SentenceRef {
  text: string;
  // range CFI of the sentence, usable for highlighting and navigation
  cfi: string;
  sectionIndex: number;
  // language of the sentence's section; used for segmentation, voice
  // pre-selection, and as a fallback for the utterance language when the
  // selected voice reports no language of its own
  lang?: string;
}

export interface SentenceCursor {
  readonly current: SentenceRef;
  // advances into following sections as needed; null = end of book
  next(): Promise<SentenceRef | null>;
  // null = start of book
  prev(): Promise<SentenceRef | null>;
}

const SECTION_CACHE_SIZE = 4;

// Elements that start a new block of text. Text on either side of their
// boundaries (or of a <br>) never belongs to the same sentence. Section
// documents are not rendered, so this goes by tag name, not computed style.
const BLOCK_ELEMENTS = new Set(
  (
    "address article aside blockquote body br caption center dd details div " +
    "dl dt figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr li " +
    "main nav ol p pre section summary table tbody td tfoot th thead tr ul"
  ).split(" "),
);

function isBlock(node: Node): boolean {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    BLOCK_ELEMENTS.has((node as Element).localName.toLowerCase())
  );
}

function blockAncestor(node: Node): Node | null {
  for (let n = node.parentNode; n; n = n.parentNode) {
    if (isBlock(n)) return n;
  }
  return null;
}

// Collects the text nodes of `doc`, grouped into runs of text that belong to
// the same block. Concatenating text across blocks would glue e.g. the end of
// one paragraph to the start of the next ("end.Next"), which sentence
// segmentation does not split, so the TTS voice would read both sentences as
// one - including the full stop between them.
function textRuns(doc: Document): Node[][] {
  const root = doc.body ?? doc.documentElement;
  if (!root) return [];
  const walker = doc.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT |
      NodeFilter.SHOW_TEXT |
      NodeFilter.SHOW_CDATA_SECTION,
    {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const name = (node as Element).localName.toLowerCase();
          if (name === "script" || name === "style") {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );
  const runs: Node[][] = [];
  let run: Node[] = [];
  let runBlock: Node | null = null;
  // a block element (or <br>) was entered since the last text node
  let boundary = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (isBlock(node)) boundary = true;
      continue;
    }
    const block = blockAncestor(node);
    if (run.length > 0 && (boundary || block !== runBlock)) {
      runs.push(run);
      run = [];
    }
    run.push(node);
    runBlock = block;
    boundary = false;
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

// A full stop, question or exclamation mark (or ellipsis), possibly followed
// by closing quotes/brackets, right after a lowercase word and directly
// followed by an uppercase letter without a space: "end.Next". Sentence
// segmentation (UAX #29, rule SB7) does not break there, but in book text it
// is almost always a missing space between two sentences. Requiring two
// lowercase letters before the mark keeps abbreviations like "Ph.D." intact.
const MISSING_SPACE_BREAK =
  /(?<=\p{Ll}\p{Ll}[.!?\u2026]+[\p{Pe}\p{Pf}"'\u2019\u201D\u00BB]*)(?=\p{Lu})/gu;

// Splits `text` into [start, end) spans of sentences, trimmed of whitespace.
// Exported for tests.
export function sentenceSpans(
  text: string,
  segmenter: Intl.Segmenter,
): [number, number][] {
  const spans: [number, number][] = [];
  const push = (start: number, end: number) => {
    const part = text.slice(start, end);
    const trimmed = part.trim();
    if (!trimmed) return;
    const s = start + part.length - part.trimStart().length;
    spans.push([s, s + trimmed.length]);
  };
  for (const seg of segmenter.segment(text)) {
    let start = seg.index;
    const end = seg.index + seg.segment.length;
    for (const m of seg.segment.matchAll(MISSING_SPACE_BREAK)) {
      const at = seg.index + m.index;
      push(start, at);
      start = at;
    }
    push(start, end);
  }
  return spans;
}

// Splits the text of `doc` into sentences with their DOM ranges.
// Exported for tests.
export function segmentDocumentSentences(
  doc: Document,
  lang?: string,
): { text: string; range: Range }[] {
  let segmenter: Intl.Segmenter;
  try {
    segmenter = new Intl.Segmenter(lang || undefined, {
      granularity: "sentence",
    });
  } catch {
    segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  }

  const result: { text: string; range: Range }[] = [];
  for (const nodes of textRuns(doc)) {
    const strings = nodes.map((node) => node.nodeValue ?? "");
    const text = strings.join("");
    if (!text.trim()) continue;
    // cumulative start offset of each string
    const offsets: number[] = [];
    let acc = 0;
    for (const s of strings) {
      offsets.push(acc);
      acc += s.length;
    }
    // map a position in the concatenated text to (string index, offset);
    // returns the last string starting at or before pos
    const locate = (pos: number): [number, number] => {
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (offsets[mid] <= pos) lo = mid;
        else hi = mid - 1;
      }
      return [lo, pos - offsets[lo]];
    };
    for (const [start, end] of sentenceSpans(text, segmenter)) {
      const [si, so] = locate(start);
      const [ei, eo] = locate(end);
      const range = doc.createRange();
      range.setStart(nodes[si], so);
      range.setEnd(nodes[ei], eo);
      result.push({ text: text.slice(start, end), range });
    }
  }
  return result;
}

function bookLanguage(book: FoliateBook): string | undefined {
  const lang = book.metadata?.language;
  return Array.isArray(lang) ? lang[0] : lang;
}

export class SentenceSource {
  #view: FoliateView;
  // language known to the application (database), overrides anything the
  // book file says about its language
  #appLang?: string;
  #bookLang?: string;
  // section index -> sentences, LRU (Map preserves insertion order)
  #cache = new Map<number, SentenceRef[]>();

  constructor(view: FoliateView, language?: string) {
    this.#view = view;
    this.#appLang = language || undefined;
    this.#bookLang = bookLanguage(view.book);
  }

  dispose(): void {
    this.#cache.clear();
  }

  #isLinear(index: number): boolean {
    return this.#view.book.sections[index]?.linear !== "no";
  }

  async sectionSentences(index: number): Promise<SentenceRef[]> {
    const cached = this.#cache.get(index);
    if (cached) {
      // refresh LRU position
      this.#cache.delete(index);
      this.#cache.set(index, cached);
      return cached;
    }
    const section = this.#view.book.sections[index];
    let sentences: SentenceRef[] = [];
    if (section && typeof section.createDocument === "function") {
      const doc = await section.createDocument();
      // per-document lang is only a hint from the same (often wrong) file as
      // the book metadata, so the application language outranks it too
      const lang = this.#appLang || doc.documentElement?.lang || this.#bookLang;
      sentences = segmentDocumentSentences(doc, lang).map(({ text, range }) => ({
        text,
        cfi: this.#view.getCFI(index, range),
        sectionIndex: index,
        lang,
      }));
    }
    this.#cache.set(index, sentences);
    if (this.#cache.size > SECTION_CACHE_SIZE) {
      const oldest = this.#cache.keys().next().value;
      if (oldest !== undefined) this.#cache.delete(oldest);
    }
    return sentences;
  }

  // first non-empty linear section at or after `index` (backwards when
  // dir < 0); returns its sentences, or null when there is none
  async firstWithSentences(
    index: number,
    dir: 1 | -1,
  ): Promise<{ index: number; sentences: SentenceRef[] } | null> {
    const count = this.#view.book.sections.length;
    for (let i = index; i >= 0 && i < count; i += dir) {
      if (!this.#isLinear(i)) continue;
      const sentences = await this.sectionSentences(i);
      if (sentences.length > 0) return { index: i, sentences };
    }
    return null;
  }

  // Cursor at the sentence containing (or the first after) `cfi`;
  // null when there is no readable text there or later in the book.
  async sentenceAt(cfi: string): Promise<SentenceCursor | null> {
    let startIndex = 0;
    let target: string | null = null;
    try {
      startIndex = this.#view.resolveCFI(cfi).index;
      target = collapse(cfi);
    } catch {
      // unparseable position - start from the beginning of the book
    }

    const found = await this.firstWithSentences(startIndex, 1);
    if (!found) return null;

    let sentenceIndex = 0;
    if (target !== null && found.index === startIndex) {
      // first sentence whose end is at or after the target point
      const arr = found.sentences;
      let lo = 0;
      let hi = arr.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (compare(collapse(arr[mid].cfi, true), target) < 0) lo = mid + 1;
        else hi = mid;
      }
      if (lo >= arr.length) {
        // past the last sentence of this section - continue in the next one
        const following = await this.firstWithSentences(found.index + 1, 1);
        if (!following) return null;
        return new Cursor(this, following.index, 0, following.sentences);
      }
      sentenceIndex = lo;
    }
    return new Cursor(this, found.index, sentenceIndex, found.sentences);
  }
}

class Cursor implements SentenceCursor {
  #source: SentenceSource;
  #sectionIndex: number;
  #sentenceIndex: number;
  #sentences: SentenceRef[];

  constructor(
    source: SentenceSource,
    sectionIndex: number,
    sentenceIndex: number,
    sentences: SentenceRef[],
  ) {
    this.#source = source;
    this.#sectionIndex = sectionIndex;
    this.#sentenceIndex = sentenceIndex;
    this.#sentences = sentences;
  }

  get current(): SentenceRef {
    return this.#sentences[this.#sentenceIndex];
  }

  async next(): Promise<SentenceRef | null> {
    if (this.#sentenceIndex + 1 < this.#sentences.length) {
      this.#sentenceIndex++;
      return this.current;
    }
    const found = await this.#source.firstWithSentences(this.#sectionIndex + 1, 1);
    if (!found) return null;
    this.#sectionIndex = found.index;
    this.#sentences = found.sentences;
    this.#sentenceIndex = 0;
    return this.current;
  }

  async prev(): Promise<SentenceRef | null> {
    if (this.#sentenceIndex > 0) {
      this.#sentenceIndex--;
      return this.current;
    }
    const found = await this.#source.firstWithSentences(this.#sectionIndex - 1, -1);
    if (!found) return null;
    this.#sectionIndex = found.index;
    this.#sentences = found.sentences;
    this.#sentenceIndex = found.sentences.length - 1;
    return this.current;
  }
}

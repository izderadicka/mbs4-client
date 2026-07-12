// Sentence iteration over a foliate-js book, for read-aloud.
//
// Sentences are addressed by CFI (stable across relayout); DOM Ranges are
// created only transiently while segmenting a section document and are never
// stored. Section documents are loaded without rendering via
// section.createDocument(), so sentences can be prefetched beyond the
// currently displayed section. Sections lacking createDocument (image-only
// formats like CBZ) yield no sentences and are skipped.

import { textWalker } from "foliate-js/text-walker.js";
import { collapse, compare } from "foliate-js/epubcfi.js";
import type { FoliateBook, FoliateView } from "foliate-js/view.js";

export interface SentenceRef {
  text: string;
  // range CFI of the sentence, usable for highlighting and navigation
  cfi: string;
  sectionIndex: number;
  // language of the sentence's section; NOT passed to synthesis (the voice
  // implies the language) - used for segmentation and voice pre-selection
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

  const matcher = function* (
    strings: string[],
    makeRange: (i: number, o: number, j: number, p: number) => Range,
  ) {
    const text = strings.join("");
    if (!text.trim()) return;
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
    for (const seg of segmenter.segment(text)) {
      const trimmed = seg.segment.trim();
      if (!trimmed) continue;
      // tighten the range to the trimmed sentence
      const startPad = seg.segment.length - seg.segment.trimStart().length;
      const start = seg.index + startPad;
      const end = start + trimmed.length;
      const [si, so] = locate(start);
      const [ei, eo] = locate(end);
      yield { text: trimmed, range: makeRange(si, so, ei, eo) };
    }
  };

  return Array.from(textWalker(doc, matcher));
}

function bookLanguage(book: FoliateBook): string | undefined {
  const lang = book.metadata?.language;
  return Array.isArray(lang) ? lang[0] : lang;
}

export class SentenceSource {
  #view: FoliateView;
  #bookLang?: string;
  // section index -> sentences, LRU (Map preserves insertion order)
  #cache = new Map<number, SentenceRef[]>();

  constructor(view: FoliateView) {
    this.#view = view;
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
      const lang = doc.documentElement?.lang || this.#bookLang;
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

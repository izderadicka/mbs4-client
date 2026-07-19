// Minimal typings for foliate-js (https://github.com/johnfactotum/foliate-js),
// which ships plain JS without type declarations. Only the parts used by the
// reader component and the TTS modules are declared here.
declare module "foliate-js/view.js" {
  export interface TOCItem {
    label: string;
    href?: string;
    subitems?: TOCItem[] | null;
  }

  export interface BookMetadata {
    title?: unknown;
    author?: unknown;
    language?: string | string[];
  }

  // one rendered section document with its overlay layer (if created)
  export interface RendererContent {
    doc: Document;
    index: number;
    // Overlayer instance; element is the SVG holding the drawn annotations
    overlayer?: { element: SVGElement };
  }

  export interface FoliateRenderer extends HTMLElement {
    next(distance?: number): Promise<void>;
    prev(distance?: number): Promise<void>;
    setStyles?(css: string): void;
    getContents(): RendererContent[];
    // select=true scrolls with relocate reason "selection", else "navigation"
    scrollToAnchor(anchor: Range | Element | number, select?: boolean): Promise<void> | void;
    destroy(): void;
  }

  // detail of the renderer-level "relocate" event; unlike the view-level
  // relocate it carries the scroll reason, needed to tell user navigation
  // from layout re-anchoring
  export interface RendererRelocateDetail {
    reason: "anchor" | "navigation" | "selection" | "page" | "snap" | "scroll";
    range: Range | null;
    index: number;
    fraction: number;
    size: number;
  }

  export interface RelocateDetail {
    fraction: number;
    cfi: string;
    range?: Range | null;
    location?: { current: number; next?: number; total?: number };
    tocItem?: TOCItem | null;
    pageItem?: TOCItem | null;
  }

  export interface FoliateSection {
    id?: string | number;
    // sections with linear === "no" are auxiliary and skipped in reading order
    linear?: string;
    cfi?: string;
    size?: number;
    // loads the section DOM without rendering it (absent for image formats)
    createDocument?(): Promise<Document>;
  }

  export interface FoliateBook {
    metadata?: BookMetadata;
    toc?: TOCItem[];
    dir?: string;
    sections: FoliateSection[];
    getCover?(): Promise<Blob | null>;
  }

  export interface Annotation {
    value: string; // CFI
    color?: string;
  }

  export interface ResolvedCFI {
    index: number;
    anchor: (doc: Document) => Range | Element;
  }

  export interface DrawAnnotationDetail {
    draw: (fn: unknown, options?: unknown) => void;
    annotation: Annotation;
    doc: Document;
    range: Range;
  }

  // emitted when a section's overlay layer is (re)created; the app must
  // re-add its annotations for that section index
  export interface CreateOverlayDetail {
    index: number;
  }

  export interface FoliateView extends HTMLElement {
    open(file: File | Blob | string): Promise<void>;
    close(): void;
    init(options: {
      lastLocation?: string;
      showTextStart?: boolean;
    }): Promise<void>;
    goTo(target: string | number): Promise<unknown>;
    goToFraction(fraction: number): Promise<void>;
    goLeft(): Promise<void> | void;
    goRight(): Promise<void> | void;
    prev(distance?: number): Promise<void>;
    next(distance?: number): Promise<void>;
    getSectionFractions(): number[];
    getCFI(index: number, range?: Range): string;
    resolveCFI(cfi: string): ResolvedCFI;
    addAnnotation(
      annotation: Annotation,
      remove?: boolean,
    ): Promise<{ index: number; label: string } | undefined>;
    deleteAnnotation(
      annotation: Annotation,
    ): Promise<{ index: number; label: string } | undefined>;
    renderer: FoliateRenderer;
    book: FoliateBook;
  }
}

declare module "foliate-js/text-walker.js" {
  // walks text nodes of a Document or Range; func receives the concatenated
  // node values and a factory turning (node index, char offset) pairs into a
  // DOM Range, and yields whatever it produces (e.g. sentence matches)
  export function textWalker<T>(
    x: Document | Range,
    func: (
      strings: string[],
      makeRange: (
        startIndex: number,
        startOffset: number,
        endIndex: number,
        endOffset: number,
      ) => Range,
    ) => Iterable<T>,
    filterFunc?: (node: Node) => number,
  ): Generator<T>;
}

declare module "foliate-js/epubcfi.js" {
  export const isCFI: RegExp;
  // total order over CFIs (works for the fake CFIs of non-EPUB formats too)
  export function compare(a: string, b: string): number;
  // reduce a range CFI to its start (or end when toEnd) point
  export function collapse(cfi: string, toEnd?: boolean): string;
}

declare module "foliate-js/overlayer.js" {
  export class Overlayer {
    // static draw functions passed to DrawAnnotationDetail.draw
    static highlight(range: Range, options?: { color?: string }): unknown;
    static underline(range: Range, options?: unknown): unknown;
  }
}

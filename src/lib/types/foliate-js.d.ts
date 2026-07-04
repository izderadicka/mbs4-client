// Minimal typings for foliate-js (https://github.com/johnfactotum/foliate-js),
// which ships plain JS without type declarations. Only the parts used by the
// reader component are declared here.
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

  export interface FoliateRenderer extends HTMLElement {
    next(distance?: number): Promise<void>;
    prev(distance?: number): Promise<void>;
    setStyles?(css: string): void;
    destroy(): void;
  }

  export interface RelocateDetail {
    fraction: number;
    cfi: string;
    location?: { current: number; next?: number; total?: number };
    tocItem?: TOCItem | null;
    pageItem?: TOCItem | null;
  }

  export interface FoliateBook {
    metadata?: BookMetadata;
    toc?: TOCItem[];
    dir?: string;
    getCover?(): Promise<Blob | null>;
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
    renderer: FoliateRenderer;
    book: FoliateBook;
  }
}

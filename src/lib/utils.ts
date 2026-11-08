import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export function formatName(name: { first_name?: string | null, last_name: string }) {
  return (name.first_name ? `${name.first_name} ${name.last_name}` : name.last_name).trim();
}

type SearchEbook = {
  title: string;
  series?: { title: string } | null;
  authors?: { first_name?: string | null; last_name: string }[] | null;
};

export function buildOnlineSearchUrl(template: string, ebook: SearchEbook): string {
  const single = ebook.authors?.length === 1 ? ebook.authors[0] : null;
  const title = ebook.title ?? "";
  const series = ebook.series?.title ?? "";
  const author = single ? formatName(single) : "";
  const authorFirst = single?.first_name ?? "";
  const authorLast = single?.last_name ?? "";
  return template
    .replaceAll("{title}", encodeURIComponent(title))
    .replaceAll("{series}", encodeURIComponent(series))
    .replaceAll("{author_first}", encodeURIComponent(authorFirst))
    .replaceAll("{author_last}", encodeURIComponent(authorLast))
    .replaceAll("{author}", encodeURIComponent(author));
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>|<!--/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  copy: "©",
  reg: "®",
  shy: "",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g,
    (match, code: string) => {
      if (code[0] === "#") {
        const cp =
          code[1] === "x" || code[1] === "X"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        try {
          return String.fromCodePoint(cp);
        } catch {
          return match;
        }
      }
      return (
        NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? match
      );
    },
  );
}

// Converts text that may contain HTML markup to plain text: tags are dropped,
// block-level boundaries become line breaks and entities are decoded. Text
// without any tags only has its entities decoded, so its line breaks survive.
export function stripHtml(text: string | null | undefined): string {
  if (!text) return "";
  if (!HTML_TAG_RE.test(text)) return decodeEntities(text);
  const plain = text
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    // source whitespace (including newlines) is insignificant in HTML
    .replace(/\s+/g, " ")
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(
      /<\/?(p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|td|th|table|caption|section|article|aside|header|footer|main|nav|figure|figcaption|address|dd|dt|dl|hr)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, "");
  return decodeEntities(plain)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

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

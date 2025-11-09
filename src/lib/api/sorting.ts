export const EBOOK_SORTING = {
    "latest": "-e.created",
    "oldest": "e.created",
    "title": "e.title",
    "reverse-title": "-e.title"
}

export type EbookSorting = keyof typeof EBOOK_SORTING;
export const EBOOK_SORTING_DEFAULT: EbookSorting = "latest";
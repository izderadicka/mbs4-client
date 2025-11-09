const EBOOK_SORTING = {
    "latest": "-e.created",
    "oldest": "e.created",
    "title": "e.title",
    "reverse-title": "-e.title"
}

export type EbookSorting = keyof typeof EBOOK_SORTING;
export const EBOOK_SORTING_DEFAULT: EbookSorting = "latest";

export function ebookSortQuery(sorting?: string) {
    if (!sorting) {
        return EBOOK_SORTING[EBOOK_SORTING_DEFAULT];
    }

    if (!(sorting in EBOOK_SORTING)) {
        return EBOOK_SORTING[EBOOK_SORTING_DEFAULT];
    }

    return EBOOK_SORTING[sorting as EbookSorting];
}

export function ebookSort(sort?: string): EbookSorting {
    if (!sort) {
        return EBOOK_SORTING_DEFAULT;
    }
    return sort in EBOOK_SORTING ? sort as EbookSorting : EBOOK_SORTING_DEFAULT;
}




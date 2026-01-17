const EBOOK_SORTING = {
    "latest": "-e.created",
    "oldest": "e.created",
    "title": "e.title",
    "reverse-title": "-e.title",
    "series-index": "e.series_index",
    "reverse-series-index": "-e.series_index"
}

export type EbookSorting = keyof typeof EBOOK_SORTING;
const EBOOK_SORTING_DEFAULT: EbookSorting = "latest";
const EBOOK_SERIES_SORTING_DEFAULT: EbookSorting = "series-index";

export function ebookSortQuery(sorting?: string) {
    if (!sorting) {
        return EBOOK_SORTING[EBOOK_SORTING_DEFAULT];
    }

    if (!(sorting in EBOOK_SORTING)) {
        return EBOOK_SORTING[EBOOK_SORTING_DEFAULT];
    }

    return EBOOK_SORTING[sorting as EbookSorting];
}

export function ebookSort(sort?: string, isSeries?: boolean): EbookSorting {
    if (!sort) {
        return isSeries ? EBOOK_SERIES_SORTING_DEFAULT : EBOOK_SORTING_DEFAULT;
    }
    return sort in EBOOK_SORTING ? sort as EbookSorting : EBOOK_SORTING_DEFAULT;
}

const AUTHOR_SORTING = {
    "latest": "-created",
    "oldest": "created",
    "name": "last_name,first_name",
    "reverse-name": "-last_name,-first_name"
}
export type AuthorSorting = keyof typeof AUTHOR_SORTING;
const AUTHOR_SORTING_DEFAULT: AuthorSorting = "latest";

export function authorSortQuery(sorting?: string) {
    if (!sorting) {
        return AUTHOR_SORTING[AUTHOR_SORTING_DEFAULT];
    }

    if (!(sorting in AUTHOR_SORTING)) {
        return AUTHOR_SORTING[AUTHOR_SORTING_DEFAULT];
    }

    return AUTHOR_SORTING[sorting as AuthorSorting];
}

export function authorSort(sort?: string): AuthorSorting {
    if (!sort) {
        return AUTHOR_SORTING_DEFAULT;
    }
    return sort in AUTHOR_SORTING ? sort as AuthorSorting : AUTHOR_SORTING_DEFAULT;
}

const SERIES_SORTING = {
    "latest": "-created",
    "oldest": "created",
    "title": "title",
    "reverse-title": "-title"
}
export type SeriesSorting = keyof typeof SERIES_SORTING;
const SERIES_SORTING_DEFAULT: SeriesSorting = "latest";

export function seriesSortQuery(sorting?: string) {
    if (!sorting) {
        return SERIES_SORTING[SERIES_SORTING_DEFAULT];
    }

    if (!(sorting in SERIES_SORTING)) {
        return SERIES_SORTING[SERIES_SORTING_DEFAULT];
    }

    return SERIES_SORTING[sorting as SeriesSorting];
}

export function seriesSort(sort?: string): SeriesSorting {
    if (!sort) {
        return SERIES_SORTING_DEFAULT;
    }
    return sort in SERIES_SORTING ? sort as SeriesSorting : SERIES_SORTING_DEFAULT;
}




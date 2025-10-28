//here is more complex logic, that is used on page or it's components

import type { EbookMetadata, Source, UploadInfo } from "$lib/api";
import { apiClient } from "$lib/api/client";
import type { EbookFormData } from "$lib/schemas";

// For historical reason we are using 2 letter codes, but metadata often uses 3 letters codes
// This is WA -  mapping from 3 letter to 2 letter
const LANG_CODES: Record<string, string> = {
    "eng": "en",
    "deu": "de",
    "rus": "ru",
    "fra": "fr",
    "spa": "es",
    "ces": "cs",
    "cze": "cs",
    "pol": "pl",
    "slk": "sk",
    "slo": "sk",

}


function normalizeAuthorName(author: EbookMetadata["authors"][0]) {
    return `${author.first_name || ""} ${author.last_name}`.trim();
}
export async function metaToEbook(meta: EbookMetadata | null): Promise<EbookFormData | null> {
    if (!meta) return null;
    const title = meta.title || "";
    const description = meta.comments?.slice(0, 5000).trim();

    const authors = [];
    for (const authorName of meta.authors) {
        try {
            const phrase = normalizeAuthorName(authorName);
            if (!phrase) continue;
            const candidates = await apiClient.searchAuthor(phrase, 2);
            if (candidates.length == 1) {
                authors.push(candidates[0].doc.Author)
            }
        } catch (e) {
            console.error("Error searching author", e);
        }
    }
    let series = null;
    let series_index = null;
    if (meta.series) {
        series_index = meta.series.index
        try {
            const candidates = await apiClient.searchSeries(meta.series.title, 2);
            if (candidates.length == 1) {
                series = candidates[0].doc.Series;
            }


        } catch (e) {
            console.error("Error searching series")
        }

    }

    let language = null;

    if (meta.language) {
        try {
            const languages = await apiClient.listLanguages();
            const lang = meta.language.toLowerCase();
            const matchingLanguage = languages.find(({ code, name }) => code.toLowerCase() === lang || code.toLowerCase() === LANG_CODES[lang] || name.toLowerCase() === lang);
            if (matchingLanguage) {
                language = matchingLanguage;
            }
        } catch (e) {
            console.error("Error fetching languages")
        }
    }

    const genres = [];
    if (meta.genres.length > 0) {
        try {
            const allGenres = await apiClient.listGenres();
            const genresMap = new Map(allGenres.map((item) => [item.name.toLowerCase(), item]))
            for (const genre of meta.genres) {
                const matchingGenre = genresMap.get(genre);
                if (matchingGenre) {
                    genres.push(matchingGenre)
                }

            }
        } catch (e) {
            console.error("Error fetching genres")
        }

    }

    return {
        title,
        description,
        authors,
        series,
        series_index,
        language,
        genres,
    }


}

export async function addFileToEbook(ebookId: number, uploadInfo: UploadInfo, metadata: EbookMetadata | null, forceCoverUpdate = false): Promise<Source> {

    try {
        const ebook = await apiClient.getEbook(ebookId);
        const source = await apiClient.addSourceToEbook(ebookId, {
            uploaded_file: uploadInfo.final_path,
            size: uploadInfo.size,
            hash: uploadInfo.hash,
        })

        if (metadata && metadata.cover_file && (forceCoverUpdate || !ebook.cover)) {
            await apiClient.changeEbookCover(ebookId, {
                cover_file: metadata.cover_file,
                ebook_id: ebook.id,
                ebook_version: ebook.version
            })
        }
        return source

    }

    catch (e) {
        console.error("Error adding file to ebook", e);
        throw e;
    }

}
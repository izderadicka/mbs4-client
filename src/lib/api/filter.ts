import type { GenreShort } from ".";
import { apiClient } from "./client";

type FilterKey = "genres";

function parseList(list: string): number[] {
    return list.split(",").map(id => parseInt(id)).filter(id => !isNaN(id));
}

export async function genresFilter(filter?: string | null): Promise<GenreShort[] | undefined> {

    if (!filter) return undefined;

    const allGenres = await apiClient.listGenres();
    const filterIds = parseList(filter);

    return allGenres.filter(g => filterIds.includes(g.id));

}

export function IdsList(items: { id: number }[] | undefined | null): string | undefined {
    return items && items.length > 0 ? items.map(i => i.id).join(",") : undefined;
}
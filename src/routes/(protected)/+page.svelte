<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  breadcrumb.path = [];
  import BookAutocomplete from "$lib/components/search-ebook.svelte";
  import { goto } from "$app/navigation";
  import type { EbookSearchItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { MAX_SEARCH_RESULTS } from "$lib/config";

  const load = async (
    q: string,
    signal: AbortSignal
  ): Promise<EbookSearchItem[]> => {
    if (!q.trim()) return [];

    const ebooks = await apiClient.searchEbook(q, MAX_SEARCH_RESULTS, signal);
    return ebooks;
  };

  function onSelect(ebookId: number) {
    goto(`/book/${ebookId}`);
  }

  function onSearch(query: string) {
    goto(`/search?q=${encodeURIComponent(query)}`);
  }
</script>

<BookAutocomplete
  {load}
  placeholder="Search by title, author, or series…"
  {onSelect}
  {onSearch}
/>

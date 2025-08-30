<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  breadcrumb.path = [];
  import BookAutocomplete from "$lib/components/search-ebook.svelte";
  import { goto } from "$app/navigation";
  import type { SearchEbookItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";

  const load = async (q: string): Promise<SearchEbookItem[]> => {
    if (!q.trim()) return [];

    const ebooks = await apiClient.search(q, 50);
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

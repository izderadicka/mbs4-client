<script lang="ts">
  import BookAutocomplete from "$lib/components/search-ebook.svelte";
  import { goto } from "$app/navigation";
  import type { SearchEbookItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";

  // Dummy loader — replace with your backend call
  const load = async (q: string): Promise<SearchEbookItem[]> => {
    if (!q.trim()) return [];

    const ebooks = await apiClient.search(q);
    return ebooks;
  };

  function onSelect(ebookId: number) {
    goto(`/books/${ebookId}`);
  }

  function onSearch(query: string) {
    goto(`/search?q=${encodeURIComponent(query)}`);
  }
</script>

<BookAutocomplete
  {load}
  maxResults={10}
  placeholder="Search by title, author, or series…"
  {onSelect}
  {onSearch}
/>

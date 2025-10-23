<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  breadcrumb.path = [];
  import BookAutocomplete from "$lib/components/search-ebook.svelte";
  import { goto } from "$app/navigation";
  import type { EbookSearchItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { MAX_SEARCH_RESULTS } from "$lib/config";

  function onSelect(ebookId: number) {
    goto(`/ebook/${ebookId}`);
  }

  function onSearch(query: string) {
    goto(`/search?q=${encodeURIComponent(query)}`);
  }
</script>

<BookAutocomplete
  placeholder="Search by title, author, or series…"
  {onSelect}
  {onSearch}
/>

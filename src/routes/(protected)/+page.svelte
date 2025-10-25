<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  breadcrumb.path = [];
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import { goto } from "$app/navigation";

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

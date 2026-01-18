<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  breadcrumb.path = [];
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import { goto } from "$app/navigation";
  import LibraryStats from "$lib/components/library-stats.svelte";
  import NewEbooks from "$lib/components/new-ebooks.svelte";

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
  {onSearch} />

<LibraryStats />

<NewEbooks />

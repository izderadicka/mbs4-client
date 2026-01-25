<script lang="ts">
  import type { Ebook, EbookDoc } from "$lib/api";
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import Title from "$lib/components/title.svelte";
  import Label from "$lib/components/ui/label/label.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import EbookInfo from "../ebook-info.svelte";

  let { data } = $props();
  let ebook = $derived(data.ebook);
  breadcrumb.path = [
    { name: "Ebooks", path: "/ebook" },
    // svelte-ignore state_referenced_locally
    { name: ebook.title, path: `/ebook/${ebook.id}` },
    { name: "Merge" },
  ];

  let otherEbook: Ebook | null = $state(null);
</script>

<Title>Merge Ebook</Title>
<EbookInfo {ebook} />

<Label>Search Other Ebook</Label>
<BookAutocomplete onSelect={(ebookID) => {}} />

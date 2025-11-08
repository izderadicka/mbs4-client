<script lang="ts">
  import { goto } from "$app/navigation";
  import { type EbookDoc } from "$lib/api";
  import EbookSearch from "$lib/components/ebook-search.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  breadcrumb.path = [{ name: "Search", path: "/search" }];
  let searchComponent: EbookSearch | null = null;
  //   onMount(() => {
  //     if (data.initialQuery) {
  //       searchComponent?.submitSearch(data.initialQuery);
  //     }
  //   });
</script>

<EbookSearch
  bind:this={searchComponent}
  actionName="Select"
  onSelect={async (ebook: EbookDoc) => await goto(`/ebook/${ebook.id}`)}
  externalControl={{
    initialQuery: data.initialQuery,
    ebooks: data.ebooks,
    handleSubmit: (q: string) => {
      goto(`/search?q=${encodeURIComponent(q)}`);
    },
  }} />

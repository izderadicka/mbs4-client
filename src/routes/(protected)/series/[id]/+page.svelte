<script lang="ts">
  import { type Series } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  let series = $derived(data.series);

  $effect(() => {
    breadcrumb.path = [
      { name: "Series", path: "/series" },
      { name: series.title },
    ];
  });
</script>

<Title>
  {series.title}
</Title>

<Subtitle>Ebooks</Subtitle>
<EbookList
  ebooks={data.ebooks}
  sort={data.sort}
  genres={data.genres}
  isSeries />

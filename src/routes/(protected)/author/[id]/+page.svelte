<script lang="ts">
  import { type Author } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  let author = $derived(data.author);
  let authorName = $derived(
    author.first_name
      ? author.first_name + " " + author.last_name
      : author.last_name,
  );
  $effect(() => {
    breadcrumb.path = [
      { name: "Authors", path: "/author" },
      { name: authorName },
    ];
  });
</script>

<Title>
  {author.first_name}
  {author.last_name}
</Title>

<Subtitle>Ebooks</Subtitle>
<EbookList ebooks={data.ebooks} sort={data.sort} genres={data.genres} />

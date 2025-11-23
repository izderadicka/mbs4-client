<script lang="ts">
  import { type Author } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";

  type props = {
    data: {
      author: Author;
    };
  };
  let { data } = $props();
  let author = $derived(data.author);
  let ebooks;
</script>

<Title>
  {author.first_name}
  {author.last_name}
</Title>

<Subtitle>Ebooks</Subtitle>
<EbookList ebooks={data.ebooks} sort={data.sort} genres={data.genres} />

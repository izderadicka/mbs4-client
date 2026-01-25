<script lang="ts">
  import type { Ebook } from "$lib/api";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";

  type Props = {
    ebook: Ebook;
    titlePrefix?: string;
  };

  let { ebook, titlePrefix }: Props = $props();
</script>

<div>
  <Title
    >{#if titlePrefix}{titlePrefix}
    {/if}{ebook.title}</Title>
  {#if ebook.series}
    <Subtitle
      ><a href="/series/{ebook.series.id}">{ebook.series.title}</a>
      #{ebook.series_index}</Subtitle>
  {/if}
  {#if ebook.authors}
    <Subtitle level={2} class="italic"
      ><AuthorsList authors={ebook.authors} /></Subtitle>
  {/if}
</div>

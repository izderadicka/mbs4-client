<script lang="ts">
  import Title from "$lib/components/title.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import type { PageProps } from "./$types";
  import { breadcrumb } from "$lib/globals.svelte";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";

  const { data }: PageProps = $props();
  const { ebook } = data;

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }, { name: ebook.title }];
</script>

<Title>{ebook.title}</Title>
{#if ebook.series}
  <Subtitle
    ><a href="/series/{ebook.series.id}">{ebook.series.title}</a>
    #{ebook.series_index}</Subtitle
  >
{/if}
{#if ebook.authors}
  <Subtitle level={2} class="italic"
    ><AuthorsList authors={ebook.authors} /></Subtitle
  >
{/if}

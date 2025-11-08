<script lang="ts" module>
  type EbookMenuActions = "edit" | "cover" | "merge";
  const EBOOK_MENU: { name: string; action: EbookMenuActions }[] = [
    { name: "Edit This Ebook", action: "edit" },
    { name: "Change Cover Image", action: "cover" },
    { name: "Merge with Other Ebook", action: "merge" },
  ];
</script>

<script lang="ts">
  import Title from "$lib/components/title.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import type { PageProps } from "./$types";
  import { breadcrumb } from "$lib/globals.svelte";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import DetailsTable from "./details-table.svelte";
  import SourcesList from "./sources-list.svelte";
  import EbookMenu from "$lib/components/item-menu.svelte";

  const { data }: PageProps = $props();
  const { ebook } = data;

  async function onMainMenuSelected(action: EbookMenuActions) {
    console.log("MainMenu action", action);
    if (action === "edit") {
      // open the edit dialog
    }
  }

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }, { name: ebook.title }];
</script>

<div class="flex flex-1 pr-5">
  <div class="">
    <Title>{ebook.title}</Title>
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
  <div class="w-7 ml-auto">
    <EbookMenu
      onMenuSelected={onMainMenuSelected}
      menu={EBOOK_MENU}
      title="Ebook Actions" />
  </div>
</div>

<DetailsTable {ebook} />
<div class="mt-4">
  <SourcesList sources={data.sources} />
</div>

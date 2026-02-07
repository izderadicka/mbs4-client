<script lang="ts" module>
  type SeriesMenuActions = "edit" | "merge";
  const SERIES_MENU: { name: string; action: SeriesMenuActions }[] = [
    { name: "Edit This Series", action: "edit" },
    { name: "Merge with Other Series", action: "merge" },
  ];
</script>

<script lang="ts">
  import { goto } from "$app/navigation";

  import { type Series } from "$lib/api";
  import EbookList from "$lib/components/ebook-list.svelte";
  import SeriesMenu from "$lib/components/item-menu.svelte";
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

  async function onMainMenuSelected(action: SeriesMenuActions) {
    if (action === "edit") {
      await goto("/series/" + series.id + "/edit");
    } else if (action === "merge") {
      await goto("/series/" + series.id + "/merge");
    }
  }
</script>

<div class="flex pr-5">
  <Title>
    {series.title}
  </Title>
  <div class="w-7 ml-auto">
    <SeriesMenu
      onMenuSelected={onMainMenuSelected}
      menu={SERIES_MENU}
      title="Series Actions" />
  </div>
</div>

<Subtitle>Ebooks</Subtitle>
<EbookList
  ebooks={data.ebooks}
  sort={data.sort}
  genres={data.genres}
  isSeries />

<script lang="ts" module>
  import { ADMIN_ROLE, TRUSTED_ROLE, type Role } from "$lib/api";
  type SeriesMenuActions = "edit" | "merge" | "bookshelf";
  const SERIES_MENU: {
    name: string;
    action: SeriesMenuActions;
    requiredRole?: Role;
  }[] = [
    { name: "Edit This Series", action: "edit", requiredRole: TRUSTED_ROLE },
    {
      name: "Merge with Other Series",
      action: "merge",
      requiredRole: ADMIN_ROLE,
    },
    {
      name: "Add to Bookshelf",
      action: "bookshelf",
      requiredRole: TRUSTED_ROLE,
    },
  ];
</script>

<script lang="ts">
  import { goto } from "$app/navigation";

  import { type Series } from "$lib/api";
  import AddToBookshelfDialog from "$lib/components/add-to-bookshelf-dialog.svelte";
  import EbookList from "$lib/components/ebook-list.svelte";
  import SeriesMenu from "$lib/components/item-menu.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import Title from "$lib/components/title.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import { breadcrumb, hasAnyRole } from "$lib/globals.svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import LibraryBigIcon from "@lucide/svelte/icons/library-big";

  let { data } = $props();
  let series = $derived(data.series);
  let addToBookshelfDialog: AddToBookshelfDialog | null = null;

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
    } else if (action === "bookshelf") {
      await onAddToBookshelf();
    }
  }

  async function onAddToBookshelf() {
    await addToBookshelfDialog?.open();
  }
</script>

<div class="flex pr-5">
  <Title>
    {series.title}
  </Title>
  <div class="ml-auto flex items-start gap-2">
    {#if hasAnyRole(TRUSTED_ROLE, ADMIN_ROLE)}
      <Button onclick={onAddToBookshelf}>
        <span class="hidden md:inline">Add to Bookshelf</span>
        <span class="inline-flex items-center gap-1 md:hidden">
          <PlusIcon class="size-4" />
          <LibraryBigIcon class="size-4" />
        </span>
      </Button>
    {/if}
    <div class="w-7">
      <SeriesMenu
        onMenuSelected={onMainMenuSelected}
        menu={SERIES_MENU}
        title="Series Actions" />
    </div>
  </div>
</div>

<Subtitle>Ebooks</Subtitle>
<EbookList
  ebooks={data.ebooks}
  sort={data.sort}
  genres={data.genres}
  isSeries />

<AddToBookshelfDialog
  bind:this={addToBookshelfDialog}
  title={series.title}
  seriesId={series.id}
  itemType="SERIES" />

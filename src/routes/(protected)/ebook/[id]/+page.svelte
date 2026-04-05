<script lang="ts" module>
  type EbookMenuActions = "edit" | "cover" | "merge" | "bookshelf";
  const EBOOK_MENU: { name: string; action: EbookMenuActions }[] = [
    { name: "Edit This Ebook", action: "edit" },
    { name: "Change Cover Image", action: "cover" },
    { name: "Merge with Other Ebook", action: "merge" },
    { name: "Add to Bookshelf", action: "bookshelf" },
  ];
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import type { PageProps } from "./$types";
  import { breadcrumb } from "$lib/globals.svelte";
  import DetailsTable from "./details-table.svelte";
  import SourcesList from "./sources-list.svelte";
  import EbookMenu from "$lib/components/item-menu.svelte";
  import { goto } from "$app/navigation";
  import EbookInfo from "./ebook-info.svelte";
  import AddToBookshelfDialog from "$lib/components/add-to-bookshelf-dialog.svelte";

  const { data }: PageProps = $props();
  let ebook = $derived(data.ebook);
  let addToBookshelfDialog: AddToBookshelfDialog | null = null;

  async function onMainMenuSelected(action: EbookMenuActions) {
    if (action === "edit") {
      await goto(`/ebook/${ebook.id}/edit`);
    } else if (action === "merge") {
      await goto(`/ebook/${ebook.id}/merge`);
    } else if (action === "cover") {
      await goto(`/ebook/${ebook.id}/cover`);
    } else if (action === "bookshelf") {
      await addToBookshelfDialog?.open();
    }
  }

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }, { name: ebook.title }];
</script>

<div class="flex pr-5">
  <EbookInfo {ebook} />
  <div class="w-7 ml-auto">
    <EbookMenu
      onMenuSelected={onMainMenuSelected}
      menu={EBOOK_MENU}
      title="Ebook Actions" />
  </div>
</div>

<DetailsTable {ebook} />
<div class="mt-4">
  <SourcesList
    sources={data.sources}
    conversions={data.conversions}
    ebookId={ebook.id} />
</div>

<AddToBookshelfDialog
  bind:this={addToBookshelfDialog}
  title={ebook.title}
  ebookId={ebook.id}
  itemType="EBOOK" />

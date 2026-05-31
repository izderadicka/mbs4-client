<script lang="ts" module>
  import { ADMIN_ROLE, TRUSTED_ROLE, type Role } from "$lib/api";
  type EbookMenuActions =
    | "edit"
    | "cover"
    | "merge"
    | "bookshelf"
    | `search:${number}`;
  const EBOOK_MENU: {
    name: string;
    action: EbookMenuActions;
    requiredRole?: Role;
  }[] = [
    { name: "Edit This Ebook", action: "edit", requiredRole: TRUSTED_ROLE },
    {
      name: "Change Cover Image",
      action: "cover",
      requiredRole: TRUSTED_ROLE,
    },
    {
      name: "Merge with Other Ebook",
      action: "merge",
      requiredRole: TRUSTED_ROLE,
    },
    {
      name: "Add to Bookshelf",
      action: "bookshelf",
      requiredRole: TRUSTED_ROLE,
    },
  ];
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import type { PageProps } from "./$types";
  import { breadcrumb, hasAnyRole } from "$lib/globals.svelte";
  import DetailsTable from "./details-table.svelte";
  import SourcesList from "./sources-list.svelte";
  import EbookMenu from "$lib/components/item-menu.svelte";
  import { goto } from "$app/navigation";
  import EbookInfo from "./ebook-info.svelte";
  import AddToBookshelfDialog from "$lib/components/add-to-bookshelf-dialog.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import LibraryBigIcon from "@lucide/svelte/icons/library-big";
  import { appSettings } from "$lib/settings.svelte";
  import { buildOnlineSearchUrl } from "$lib/utils";

  const { data }: PageProps = $props();
  let ebook = $derived(data.ebook);
  let addToBookshelfDialog: AddToBookshelfDialog | null = null;

  let menu = $derived([
    ...EBOOK_MENU,
    ...appSettings.onlineSearches.map((s, i) => ({
      name: `Search on ${s.name}`,
      action: `search:${i}` as const,
    })),
  ]);

  async function onMainMenuSelected(action: EbookMenuActions) {
    if (action.startsWith("search:")) {
      const idx = Number(action.slice("search:".length));
      const engine = appSettings.onlineSearches[idx];
      if (engine) {
        const url = buildOnlineSearchUrl(engine.urlTemplate, ebook);
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (action === "edit") {
      await goto(`/ebook/${ebook.id}/edit`);
    } else if (action === "merge") {
      await goto(`/ebook/${ebook.id}/merge`);
    } else if (action === "cover") {
      await goto(`/ebook/${ebook.id}/cover`);
    } else if (action === "bookshelf") {
      await onAddToBookshelf();
    }
  }

  async function onAddToBookshelf() {
    await addToBookshelfDialog?.open();
  }

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }, { name: ebook.title }];
</script>

<div class="flex pr-5">
  <EbookInfo {ebook} />
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
    <EbookMenu
      onMenuSelected={onMainMenuSelected}
      {menu}
      title="Ebook Actions" />
    </div>
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

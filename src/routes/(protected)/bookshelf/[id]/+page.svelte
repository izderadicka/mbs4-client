<script lang="ts" module>
  import { TRUSTED_ROLE, ADMIN_ROLE, type Role } from "$lib/api";
  type BookshelfMenuActions = "edit" | "batch_convert";
  const BOOKSHELF_MENU: { name: string; action: BookshelfMenuActions; requiredRole?: Role }[] = [
    { name: "Edit this Bookshelf", action: "edit" },
    { name: "Convert All to Format…", action: "batch_convert", requiredRole: TRUSTED_ROLE },
  ];
</script>

<script lang="ts">
  import Title from "$lib/components/title.svelte";
  import { breadcrumb, hasAnyRole } from "$lib/globals.svelte.js";
  import ItemsList from "./items-list.svelte";
  import BookshelfMenu from "$lib/components/item-menu.svelte";
  import BatchConvertDialog from "$lib/components/batch-convert-dialog.svelte";
  import { goto } from "$app/navigation";

  const { data } = $props();
  const bookshelf = $derived(data.bookshelf);
  const user = $derived(data.user);
  const isMine = $derived(bookshelf.created_by === user?.email);
  let batchConvertDialog: BatchConvertDialog | null = null;

  // svelte-ignore state_referenced_locally
  const parent_segment = !isMine
    ? { name: "Public Bookshelves", path: "/bookshelf?public" }
    : { name: "My Bookshelves", path: "/bookshelf" };

  // svelte-ignore state_referenced_locally
  breadcrumb.path = [parent_segment, { name: bookshelf.name }];

  async function onMainMenuSelected(action: BookshelfMenuActions) {
    if (action === "edit") {
      goto(`/bookshelf/${bookshelf.id}/edit`);
    } else if (action === "batch_convert") {
      await batchConvertDialog?.open();
    }
  }
</script>

<div class="flex pr-5">
  <Title>{bookshelf.name}</Title>
  {#if isMine || hasAnyRole(TRUSTED_ROLE, ADMIN_ROLE)}
    <div class="w-7 ml-auto">
      <BookshelfMenu
        onMenuSelected={onMainMenuSelected}
        menu={BOOKSHELF_MENU}
        title="Bookshelf Actions" />
    </div>
  {/if}
</div>

{#if bookshelf.description}
  <p>{bookshelf.description}</p>
{/if}

<ItemsList bookshelfId={bookshelf.id} items={data.items} sort={data.sort} />

<BatchConvertDialog
  bind:this={batchConvertDialog}
  title={bookshelf.name}
  forEntity="BOOKSHELF"
  entityId={bookshelf.id} />

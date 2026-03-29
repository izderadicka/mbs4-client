<script lang="ts" module>
  type BookshelfMenuActions = "edit";
  const BOOKSHELF_MENU = [{ name: "Edit this Bookshelf", action: "edit" }];
</script>

<script lang="ts">
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import ItemsList from "./items-list.svelte";
  import BookshelfMenu from "$lib/components/item-menu.svelte";
  import type { it } from "vitest";

  const { data } = $props();
  const bookshelf = $derived(data.bookshelf);
  const user = $derived(data.user);
  const isMime = $derived(bookshelf.created_by === user?.email);

  // svelte-ignore state_referenced_locally
  const parent_segment = !isMime
    ? { name: "Public Bookshelves", path: "/bookshelf?public" }
    : { name: "My Bookshelves", path: "/bookshelf" };

  // svelte-ignore state_referenced_locally
  breadcrumb.path = [parent_segment, { name: bookshelf.name }];

  function onMainMenuSelected(action: string) {}
</script>

<div class="flex pr-5">
  <Title>{bookshelf.name}</Title>
  <div class="w-7 ml-auto">
    <BookshelfMenu
      onMenuSelected={onMainMenuSelected}
      menu={BOOKSHELF_MENU}
      title="Bookshelf Actions" />
  </div>
</div>

{#if bookshelf.description}
  <p>{bookshelf.description}</p>
{/if}

<ItemsList items={data.items} sort={data.sort} />

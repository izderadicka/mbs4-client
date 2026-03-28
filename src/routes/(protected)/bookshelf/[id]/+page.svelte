<script lang="ts">
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import ItemsList from "./items-list.svelte";

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
</script>

<Title>{bookshelf.name}</Title>
{#if bookshelf.description}
  <p>{bookshelf.description}</p>
{/if}

<ItemsList items={data.items} sort={data.sort} />

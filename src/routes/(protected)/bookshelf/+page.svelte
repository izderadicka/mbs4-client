<script lang="ts" module>
  const SORTING: { label: string; value: BookshelfSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Name", value: "name" },
    { label: "Reverse Name", value: "reverse-name" },
  ];
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import type { BookshelfSorting } from "$lib/api/sorting";
  import Pager from "$lib/components/pager.svelte";
  import SortSelect from "$lib/components/fragments/sort-select.svelte";
  import AddButton from "$lib/components/fragments/add-button.svelte";

  let { data } = $props();
  let bookshelves = $derived(data.bookshelves);
  let sort = $derived(data.sort);
  let publicOnly = $derived(data.publicOnly);
  let breadcrumbName = $derived(
    publicOnly ? "Public Bookshelves" : "My Bookshelves",
  );

  $effect(() => {
    breadcrumb.path = [{ name: breadcrumbName }];
  });
</script>

<Title>Bookshelves</Title>

<div class="flex gap-2">
  <SortSelect bind:sort sorting={SORTING} />
  {#if !publicOnly}
    <AddButton entity="bookshelf" />
  {/if}
</div>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-16">Id</Table.Head>
      <Table.Head class="w-[80%]">Name</Table.Head>
      <Table.Head>Items</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each bookshelves.rows as bookshelf (bookshelf.id)}
      {#snippet linked(text?: string | number | null)}
        {#if text}
          <a href="/bookshelf/{bookshelf.id}">{text}</a>
        {/if}
      {/snippet}
      <Table.Row>
        <Table.Cell class="font-medium"
          >{@render linked(bookshelf.id)}</Table.Cell>
        <Table.Cell class="truncate"
          >{@render linked(bookshelf.name)}</Table.Cell>
        <Table.Cell class="truncate"
          >{@render linked(bookshelf.items_count)}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pager
  count={bookshelves.total}
  pageSize={bookshelves.page_size}
  page={bookshelves.page} />

<script lang="ts" module>
  const SORTING: { label: string; value: AuthorSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Name", value: "name" },
    { label: "Reverse Name", value: "reverse-name" },
  ];
</script>

<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import type { AuthorSorting } from "$lib/api/sorting";
  import Pager from "$lib/components/pager.svelte";
  import SortSelect from "$lib/components/fragments/sort-select.svelte";
  import AddButton from "$lib/components/fragments/add-button.svelte";

  breadcrumb.path = [{ name: "Authors", path: "/author" }];

  let { data } = $props();
  let authors = $derived(data.authors);
  let sort = $derived(data.sort);
</script>

<Title>Authors</Title>

<div class="flex gap-2">
  <SortSelect bind:sort sorting={SORTING} />
  <AddButton entity="author" />
</div>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Id</Table.Head>
      <Table.Head class="w-[40%]">First Name</Table.Head>
      <Table.Head>Last Name</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each authors.rows as author (author.id)}
      {#snippet linked(text?: string | number | null)}
        {#if text}
          <a href="/author/{author.id}">{text}</a>
        {/if}
      {/snippet}
      <Table.Row>
        <Table.Cell class="font-medium">{@render linked(author.id)}</Table.Cell>
        <Table.Cell class="truncate"
          >{@render linked(author.first_name)}</Table.Cell>
        <Table.Cell class="truncate"
          >{@render linked(author.last_name)}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pager count={authors.total} pageSize={authors.page_size} page={authors.page} />

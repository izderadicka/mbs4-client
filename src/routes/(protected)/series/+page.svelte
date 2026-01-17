<script lang="ts" module>
  import { type SeriesSorting } from "$lib/api/sorting";
  const SORTING: { label: string; value: SeriesSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Title", value: "title" },
    { label: "Reverse Title", value: "reverse-title" },
  ];
</script>

<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import Pager from "$lib/components/pager.svelte";
  import SortSelect from "$lib/components/fragments/sort-select.svelte";
  import AddButton from "$lib/components/fragments/add-button.svelte";

  breadcrumb.path = [{ name: "Series", path: "/series" }];

  let { data } = $props();
  let series = $derived(data.series);
  let sort = $derived(data.sort);
</script>

<Title>Series</Title>

<div class="flex gap-2">
  <SortSelect bind:sort sorting={SORTING} />
  <AddButton entity="series" />
</div>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Id</Table.Head>
      <Table.Head>Title</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each series.rows as ser (ser.id)}
      {#snippet linked(text?: string | number | null)}
        {#if text}
          <a href="/series/{ser.id}">{text}</a>
        {/if}
      {/snippet}
      <Table.Row>
        <Table.Cell class="font-medium">{@render linked(ser.id)}</Table.Cell>
        <Table.Cell class="truncate">{@render linked(ser.title)}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pager count={series.total} pageSize={series.page_size} page={series.page} />

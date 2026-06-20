<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import { apiClient } from "$lib/api/client";

  let { data } = $props();
  let batch = $derived(data.batch);
  let items = $derived(data.items);

  $effect(() => {
    breadcrumb.path = [
      { name: "Batch Conversions", path: "/conversion-batch" },
      { name: batch.name },
    ];
  });
</script>

<div class="flex items-start justify-between pr-5">
  <Title>{batch.name}</Title>
  {#if batch.zip_location}
    <a
      href={apiClient.conversionUrl(batch.zip_location)}
      class="mt-1 text-sm font-medium underline underline-offset-2">
      Download ZIP
    </a>
  {/if}
</div>

<dl class="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
  <dt class="opacity-60">Entity</dt>
  <dd>{batch.for_entity ?? "—"}</dd>
  <dt class="opacity-60">Format ID</dt>
  <dd>{batch.format_id}</dd>
  <dt class="opacity-60">Created</dt>
  <dd>{new Date(batch.created).toLocaleString()}</dd>
  <dt class="opacity-60">Created by</dt>
  <dd class="truncate">{batch.created_by ?? "—"}</dd>
</dl>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-16">Id</Table.Head>
      <Table.Head class="w-[40%]">Ebook</Table.Head>
      <Table.Head class="w-32">Source format</Table.Head>
      <Table.Head class="w-32">Target format</Table.Head>
      <Table.Head class="w-36">Created</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each items as item (item.id)}
      <Table.Row>
        <Table.Cell class="font-medium">{item.id}</Table.Cell>
        <Table.Cell class="truncate">
          <a href="/ebook/{item.ebook_id}">Ebook #{item.ebook_id}</a>
        </Table.Cell>
        <Table.Cell>{item.source_format_extension}</Table.Cell>
        <Table.Cell>{item.format_extension}</Table.Cell>
        <Table.Cell>{new Date(item.created).toLocaleDateString()}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

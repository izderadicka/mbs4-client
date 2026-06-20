<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";
  import Pager from "$lib/components/pager.svelte";
  import { apiClient } from "$lib/api/client";

  let { data } = $props();
  let batches = $derived(data.batches);

  $effect(() => {
    breadcrumb.path = [{ name: "Batch Conversions" }];
  });
</script>

<Title>Batch Conversions</Title>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-16 hidden lg:table-cell">Id</Table.Head>
      <Table.Head class="w-[55%]">Name</Table.Head>
      <Table.Head class="w-24 hidden lg:table-cell">Entity</Table.Head>
      <Table.Head class="w-[20%]">Created</Table.Head>
      <Table.Head>Download</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each batches.rows as batch (batch.id)}
      <Table.Row>
        <Table.Cell class="font-medium hidden lg:table-cell">
          <a href="/conversion-batch/{batch.id}">{batch.id}</a>
        </Table.Cell>
        <Table.Cell class="truncate">
          <a href="/conversion-batch/{batch.id}">{batch.name}</a>
        </Table.Cell>
        <Table.Cell class="hidden lg:table-cell"
          >{batch.for_entity ?? "—"}</Table.Cell>
        <Table.Cell class="truncate"
          >{new Date(batch.created).toLocaleDateString()}</Table.Cell>
        <Table.Cell class="truncate">
          {#if batch.zip_location}
            <a href={apiClient.conversionUrl(batch.zip_location)}
              >Download ZIP</a>
          {:else}
            —
          {/if}
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pager count={batches.total} pageSize={batches.page_size} page={batches.page} />

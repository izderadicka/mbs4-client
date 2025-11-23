<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Table from "$lib/components/ui/table/index.js";

  breadcrumb.path = [{ name: "Authors", path: "/author" }];

  let { data } = $props();
  let authors = $derived(data.authors);
</script>

<Title>Authors</Title>

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

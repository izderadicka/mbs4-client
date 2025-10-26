<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import Pager from "$lib/components/pager.svelte";
  import Title from "$lib/components/title.svelte";

  const { data } = $props();
  const ebooks = $derived(data.ebooks);

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }];

  const count = $derived(ebooks.total * ebooks.page_size);
</script>

<Title>All Ebooks</Title>

<Table.Root class="table-fixed w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Id</Table.Head>
      <Table.Head class="w-[20%]">Authors</Table.Head>
      <Table.Head>Title</Table.Head>
      <Table.Head class="hidden lg:table-cell">Series</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each ebooks.rows as ebook (ebook.id)}
      <Table.Row>
        <Table.Cell class="font-medium">{ebook.id}</Table.Cell>
        <Table.Cell class="truncate"
          ><AuthorsList
            authors={ebook.authors || []}
            short={true}
          /></Table.Cell
        >
        <Table.Cell class="truncate"
          ><a href="/ebook/{ebook.id}">{ebook.title}</a></Table.Cell
        >
        <Table.Cell class="truncate hidden lg:table-cell">
          {#if ebook.series}
            <a href="/series/{ebook.series.id}">{ebook.series.title}</a>
          {/if}
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pager {count} pageSize={ebooks.page_size} page={ebooks.page} />

<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  const { data } = $props();
  const { ebooks } = data;
</script>

<Table.Root>
  <Table.Caption>Ebooks</Table.Caption>
  <Table.Header>
    <Table.Row>
      <Table.Head>Id</Table.Head>
      <Table.Head>Authors</Table.Head>
      <Table.Head>Title</Table.Head>
      <Table.Head>Series</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each ebooks.rows as ebook}
      <Table.Row>
        <Table.Cell class="font-medium">{ebook.id}</Table.Cell>
        <Table.Cell>{"tbd"}</Table.Cell>
        <Table.Cell>{ebook.title}</Table.Cell>
        <Table.Cell>{"tbd"}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

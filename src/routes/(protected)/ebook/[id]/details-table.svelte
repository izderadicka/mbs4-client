<script lang="ts">
  import type { Ebook } from "$lib/api";
  import CoverImage from "$lib/components/fragments/cover-image.svelte";
  import * as Table from "$lib/components/ui/table";
  import { hasRole } from "$lib/globals.svelte";
  let { ebook }: { ebook: Ebook } = $props();
</script>

<div class="flex flex-col lg:flex-row gap-2">
  <CoverImage class="w-xs md:w-md mr-2" file={ebook.cover} />
  <Table.Root
    class="table-fixed w-full [&_tbody_th]:w-36
         [&_tbody_th]:pr-4
         [&_tbody_th]:font-semibold
         [&_tbody_th]:text-left
         [&_tbody_th]:align-middle
         [&_tbody_th]:whitespace-nowrap
         [&_tbody_th]:truncate
         [&_tbody_td]:truncate">
    <Table.Body>
      <Table.Row>
        <Table.Head>Language</Table.Head><Table.Cell
          >{ebook.language.name}</Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Head>Genres</Table.Head>
        <Table.Cell
          >{ebook.genres?.map((g) => g.name).join(", ") || ""}</Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Head>Created on</Table.Head>
        <Table.Cell>{ebook.created}</Table.Cell>
      </Table.Row>
      <Table.Row>
        <Table.Head>Last updated on</Table.Head>
        <Table.Cell>{ebook.modified}</Table.Cell>
      </Table.Row>
      {#if hasRole("Admin")}
        <Table.Row>
          <Table.Head>Created by</Table.Head>
          <Table.Cell>{ebook.created_by || ""}</Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>

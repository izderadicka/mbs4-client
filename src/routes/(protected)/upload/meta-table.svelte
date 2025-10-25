<script lang="ts">
  import type { EbookMetadata } from "$lib/api";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import CoverImage from "$lib/components/fragments/cover-image.svelte";
  import FailureAlert from "$lib/components/fragments/failure-alert.svelte";
  import * as Table from "$lib/components/ui/table";
  let { metadata }: { metadata: EbookMetadata | null } = $props();
</script>

{#if metadata}
  <div class="flex flex-col md:flex-row gap-2">
    <CoverImage class="w-40 mr-2" file={metadata.cover_file} uploaded={true} />
    <Table.Root
      class="table-fixed w-full [&_tbody_th]:w-30
         [&_tbody_th]:pr-4
         [&_tbody_th]:font-semibold
         [&_tbody_th]:text-left
         [&_tbody_th]:align-middle
         [&_tbody_th]:whitespace-nowrap
         [&_tbody_th]:truncate
         [&_tbody_td]:truncate"
    >
      <Table.Body>
        <Table.Row>
          <Table.Head>Title</Table.Head>
          <Table.Cell>{metadata.title}</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Head>Authors</Table.Head>
          <Table.Cell>
            <AuthorsList authors={metadata.authors} />
          </Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Head>Series</Table.Head>
          <Table.Cell
            >{#if metadata.series}{metadata.series.title} #{metadata.series
                .index}{/if}</Table.Cell
          >
        </Table.Row>
        <Table.Row>
          <Table.Head>Language</Table.Head><Table.Cell
            >{metadata.language || ""}</Table.Cell
          >
        </Table.Row>
        <Table.Row>
          <Table.Head>Genres</Table.Head>
          <Table.Cell>{metadata.genres.join(", ")}</Table.Cell>
        </Table.Row>
        <Table.Row>
          <Table.Head>Description</Table.Head>
          <Table.Cell>{metadata.comments || ""}</Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <FailureAlert title="Something went wrong">
    <p>Metadata missing</p>
  </FailureAlert>
{/if}

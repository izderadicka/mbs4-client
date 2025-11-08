<script lang="ts">
  import type { Ebook, EbookSource } from "$lib/api";
  import * as Table from "$lib/components/ui/table";
  import prettyBytes from "pretty-bytes";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import { Button } from "$lib/components/ui/button";
  import { apiClient } from "$lib/api/client";
  import SourceMenu from "./source-menu.svelte";

  let { sources }: { sources: EbookSource[] } = $props();

  function onSourceMenuSelected(source: EbookSource, action: string) {
    console.log("onSourceMenuSelected", source, action);
  }
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Format</Table.Head>
      <Table.Head>Size</Table.Head>
      <Table.Head>Download</Table.Head>
      <Table.Head>More ...</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each sources as source (source.id)}
      <Table.Row>
        <Table.Cell class="font-medium">{source.format_extension}</Table.Cell>
        <Table.Cell>{prettyBytes(source.size)}</Table.Cell>
        <Table.Cell class="w-3"
          ><Button href={apiClient.downloadUrl(source.location)} variant="link"
            ><DownloadIcon /></Button
          ></Table.Cell>
        <Table.Cell class="w-3">
          <SourceMenu {source} onMenuSelected={onSourceMenuSelected} />
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

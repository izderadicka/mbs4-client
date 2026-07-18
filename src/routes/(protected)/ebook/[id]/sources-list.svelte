<script lang="ts">
  import type {
    ConversionResult,
    Ebook,
    EbookConversion,
    EbookSource,
  } from "$lib/api";
  import * as Table from "$lib/components/ui/table";
  import prettyBytes from "pretty-bytes";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import { Button } from "$lib/components/ui/button";
  import { apiClient } from "$lib/api/client";
  import { READER_FORMATS } from "$lib/config";
  import SourceMenu from "./source-menu.svelte";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import { events } from "$lib/globals.svelte";
  import { toast } from "svelte-sonner";
  import DeleteDialog from "$lib/components/delete-dialog.svelte";
  import MoveSourceDialog from "$lib/components/move-source-dialog.svelte";

  let {
    sources,
    conversions,
    ebookId,
  }: {
    sources: EbookSource[];
    conversions: EbookConversion[];
    ebookId: number;
  } = $props();

  function isReadable(formatExtension: string): boolean {
    return READER_FORMATS.includes(formatExtension.toLowerCase());
  }

  function readerUrl(kind: "source" | "conversion", id: number): string {
    return `/read?ebook=${ebookId}&${kind}=${id}`;
  }

  let conversionTicketId: string | null = $state(null);

  async function startConversion(source: EbookSource, format: string) {
    try {
      const conversion_ticket = await apiClient.convertSource({
        source_id: source.id,
        to_format_extension: format,
      });

      conversionTicketId = conversion_ticket.id;
      console.log("conversion started", conversion_ticket);
    } catch (error: any) {
      console.error("Failed to start conversion", error);
      toast.error(
        `Failed to start conversion: ${error.message ? error.message : error}`,
      );
    }
  }

  $effect(() => {
    if (!conversionTicketId) return;
    const event = events.items.find(
      (e) =>
        ((e.data as any)?.data as ConversionResult)?.operation_id ===
        conversionTicketId,
    );
    if (!event) return;
    const result = (event.data as any).data as ConversionResult;
    conversionTicketId = null;
    if (result.error) {
      console.error("Conversion failed", result.error);
      toast.error("Conversion failed: " + result.error);
      return;
    }
    console.log("conversion done", result);
    if (result.conversion) {
      apiClient
        .listEbookConversions(ebookId)
        .then((res) => {
          conversions = res;
        })
        .catch((error) => {
          console.error("Failed to list conversions", error);
        });
    }
  });

  function onSourceMenuSelected(
    source: EbookSource,
    action: string,
    data?: { format: string },
  ) {
    if (action === "convert") {
      startConversion(source, data!!.format);
    } else if (action === "delete") {
      deleteDialog.openDialog({
        id: source.id,
        name: "ebook source",
        detail: `${source.format_extension} (${prettyBytes(source.size)})`,
      });
    } else if (action === "move") {
      moveDialog.openDialog(source);
    }
    console.debug("onSourceMenuSelected", source, action);
  }

  function removeSource(id: number) {
    sources = sources.filter((source) => source.id !== id);
  }

  function deleteSource(id: number) {
    apiClient
      .deleteSource(id)
      .then(() => {
        removeSource(id);
      })
      .catch((error) => {
        console.error("Failed to delete source", error);
        toast.error("Failed to delete source");
      });
  }

  function onConversionMenuSelected(source: EbookConversion, action: string) {
    if (action === "delete") {
      apiClient
        .deleteConversion(source.id)
        .then(() => {
          conversions = conversions.filter((c) => c.id !== source.id);
        })
        .catch((error) => {
          console.error("Failed to delete conversion", error);
          toast.error("Failed to delete conversion");
        });
    }
    console.debug("onConversionMenuSelected", source, action);
  }

  let deleteDialog: DeleteDialog;
  let moveDialog: MoveSourceDialog;
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Format</Table.Head>
      <Table.Head>Size/Conversion</Table.Head>
      <Table.Head>Download</Table.Head>
      <Table.Head>Read</Table.Head>
      <Table.Head>More ...</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#if conversionTicketId}
      <Table.Row>
        <Table.Cell><Spinner /></Table.Cell>
        <Table.Cell>Converting ...</Table.Cell>
      </Table.Row>
    {/if}
    {#each conversions as conversion (conversion.id)}
      <Table.Row>
        <Table.Cell class="font-medium"
          >{conversion.format_extension}</Table.Cell>
        <Table.Cell>from {conversion.source_format_extension}</Table.Cell>
        <Table.Cell class="w-3"
          ><Button
            href={apiClient.conversionUrl(conversion.location)}
            target="_blank"
            variant="link"><DownloadIcon /></Button
          ></Table.Cell>
        <Table.Cell class="w-3">
          {#if isReadable(conversion.format_extension)}
            <Button
              href={readerUrl("conversion", conversion.id)}
              target="_blank"
              title="Read online"
              variant="link"><BookOpenIcon /></Button>
          {/if}
        </Table.Cell>
        <Table.Cell class="w-3">
          <SourceMenu source={conversion} {onConversionMenuSelected} />
        </Table.Cell>
      </Table.Row>
    {/each}
    {#each sources as source (source.id)}
      <Table.Row>
        <Table.Cell class="font-medium">{source.format_extension}</Table.Cell>
        <Table.Cell>{prettyBytes(source.size)}</Table.Cell>
        <Table.Cell class="w-3"
          ><Button href={apiClient.downloadUrl(source.location)} variant="link"
            ><DownloadIcon /></Button
          ></Table.Cell>
        <Table.Cell class="w-3">
          {#if isReadable(source.format_extension)}
            <Button
              href={readerUrl("source", source.id)}
              target="_blank"
              title="Read online"
              variant="link"><BookOpenIcon /></Button>
          {/if}
        </Table.Cell>
        <Table.Cell class="w-3">
          <SourceMenu {source} {onSourceMenuSelected} />
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<DeleteDialog bind:this={deleteDialog} onConfirmedDelete={deleteSource} />
<MoveSourceDialog
  bind:this={moveDialog}
  currentEbookId={ebookId}
  onMoved={removeSource} />

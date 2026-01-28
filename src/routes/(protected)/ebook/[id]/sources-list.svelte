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
  import { Button } from "$lib/components/ui/button";
  import { apiClient } from "$lib/api/client";
  import SourceMenu from "./source-menu.svelte";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import { lastEvent } from "$lib/globals.svelte";
  import { toast } from "svelte-sonner";
  import DeleteDialog from "$lib/components/delete-dialog.svelte";

  let {
    sources,
    conversions,
    ebookId,
  }: {
    sources: EbookSource[];
    conversions: EbookConversion[];
    ebookId: number;
  } = $props();

  let conversionTicketId: string | null = $state(null);

  async function startConversion(source: EbookSource, format: string) {
    const conversion_ticket = await apiClient.convertSource({
      source_id: source.id,
      to_format_extension: format,
    });

    conversionTicketId = conversion_ticket.id;
    console.log("conversion started", conversion_ticket);
  }

  $effect(() => {
    if (!conversionTicketId) return;
    const event = lastEvent();
    if (event && event.data) {
      const result = (event.data as any).data as ConversionResult;
      if (result.operation_id === conversionTicketId) {
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
          // TODO: update
          // conversions = [result.conversion, ...conversions];
        }
      }
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
    }
    console.debug("onSourceMenuSelected", source, action);
  }

  function deleteSource(id: number) {
    apiClient
      .deleteSource(id)
      .then(() => {
        apiClient
          .listEbookSources(ebookId)
          .then((res) => {
            sources = res;
          })
          .catch((error) => {
            console.error("Failed to list sources", error);
          });
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
          apiClient
            .listEbookConversions(ebookId)
            .then((res) => {
              conversions = res;
            })
            .catch((error) => {
              console.error("Failed to list conversions", error);
            });
        })
        .catch((error) => {
          console.error("Failed to delete conversion", error);
          toast.error("Failed to delete conversion");
        });
    }
    console.debug("onConversionMenuSelected", source, action);
  }

  let deleteDialog: DeleteDialog;
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head class="w-[4rem]">Format</Table.Head>
      <Table.Head>Size/Conversion</Table.Head>
      <Table.Head>Download</Table.Head>
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
          <SourceMenu {source} {onSourceMenuSelected} />
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<DeleteDialog bind:this={deleteDialog} onConfirmedDelete={deleteSource} />

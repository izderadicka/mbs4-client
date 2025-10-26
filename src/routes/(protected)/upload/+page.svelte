<script lang="ts">
  import UploadForm from "./upload-form.svelte";
  import { breadcrumb, lastEvent } from "$lib/globals.svelte";
  import type {
    EbookMetadata,
    MetaResult,
    OperationTicket,
    UploadInfo,
  } from "$lib/api";
  import Title from "$lib/components/title.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import FailureAlert from "$lib/components/fragments/failure-alert.svelte";
  import WaitingMeta from "./waiting-meta.svelte";
  import MetaCard from "./meta-card.svelte";
  import SearchCard from "./search-card.svelte";
  breadcrumb.path = [{ name: "Upload Ebook", path: "/upload" }];

  type UploadStage = "upload" | "metadata" | "select" | "done";

  let stage: UploadStage = $state("upload");

  let metaTicket: OperationTicket | null = null;
  let uploadInfo: UploadInfo | null = null;
  // svelte-ignore non_reactive_update
  let metadata: EbookMetadata | null = null;
  let error: string | null = $state(null);

  // svelte-ignore non_reactive_update
  let uploadForm: UploadForm;

  function handleFileUpload(result: {
    uploadInfo: UploadInfo;
    metaTicket: OperationTicket;
  }) {
    uploadInfo = result.uploadInfo;
    metaTicket = result.metaTicket;
    stage = "metadata";
  }

  $effect(() => {
    if (stage === "metadata" && metaTicket) {
      const event = lastEvent();
      if (event && event.data) {
        const result = (event.data as any).data as MetaResult;
        if (result.operation_id === metaTicket.id) {
          if (result.success && result.metadata) {
            metadata = result.metadata;
            stage = "select";
          } else {
            console.error("Failed to retrieve metadata", result);
            error = result.error || "Unknown error while retrieving metadata";
            stage = "select";
          }
          metaTicket = null;
        }
      }
    }
  });

  function initRestart(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    restart();
  }

  function restart() {
    stage = "upload";
    uploadForm?.reset();
    metaTicket = null;
    uploadInfo = null;
    metadata = null;
    error = null;
  }
</script>

<Title>Upload file to new or existing ebook</Title>

{#if error}
  <FailureAlert title="Error during upload processing">
    <p>{error}</p>
    <p>
      Please try again from <a
        class="underline"
        href="#restart"
        onclick={initRestart}>beginning</a
      >
    </p>
  </FailureAlert>
{/if}

{#if stage === "upload"}
  <Subtitle>1. Upload</Subtitle>
  <UploadForm
    bind:this={uploadForm}
    onUpload={handleFileUpload}
    onError={(err) => (error = err)}
  />
{/if}

{#if stage === "metadata"}
  <Subtitle>2. Waiting for metadata</Subtitle>
  <WaitingMeta onRestart={restart} />
{/if}

{#if stage === "select"}
  <Subtitle>3. Search existing ebooks</Subtitle>
  <MetaCard {metadata} />
  <SearchCard {metadata} />
{/if}

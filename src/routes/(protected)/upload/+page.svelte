<script lang="ts">
  import UploadForm from "./upload-form.svelte";
  import { breadcrumb, lastEvent } from "$lib/globals.svelte";
  import type {
    Ebook,
    EbookDoc,
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
  import CreateCard from "./create-card.svelte";
  import { addFileToEbook, metaToEbook } from "./logic";
  import type { EbookFormData } from "$lib/schemas";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  breadcrumb.path = [{ name: "Upload Ebook", path: "/upload" }];

  type UploadStage = "upload" | "metadata" | "select" | "create";

  let stage: UploadStage = $state("upload");

  let metaTicket: OperationTicket | null = null;
  // svelte-ignore non_reactive_update
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
          if (!result.error && result.metadata) {
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

  // svelte-ignore non_reactive_update
  let newEbookData: EbookFormData | null = null;
  async function onNew() {
    newEbookData = await metaToEbook(metadata);
    stage = "create";
  }

  function onCreateCancel() {
    stage = "select";
    newEbookData = null;
  }

  async function assignFile(ebook: Ebook | EbookDoc) {
    try {
      const source = await addFileToEbook(ebook.id, uploadInfo!, metadata);
      console.debug("Added file to ebook", source);
      await goto(`/ebook/${ebook.id}`);
    } catch (ee: any) {
      console.error(
        `Error adding file to  ebook ${ebook.title} (${ebook.id})`,
        ee,
      );
      error = ee.toString();
    }
  }

  async function onChosen(ebook: EbookDoc) {
    await assignFile(ebook);
  }

  async function afterCreate(ebook: Ebook) {
    await assignFile(ebook);
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
        onclick={initRestart}>beginning</a>
    </p>
  </FailureAlert>
{/if}

{#if stage === "upload"}
  <Subtitle>1. Upload</Subtitle>
  <UploadForm
    bind:this={uploadForm}
    onUpload={handleFileUpload}
    onError={(err) => (error = err)} />
{/if}

{#if stage === "metadata"}
  <Subtitle>2. Waiting for metadata</Subtitle>
  <WaitingMeta onRestart={restart} />
{/if}

{#if stage === "select" && metadata && uploadInfo}
  <Subtitle>3. Search existing ebooks</Subtitle>
  <MetaCard {metadata} {uploadInfo} />
  <SearchCard {metadata} {onChosen} {onNew} />
{/if}

{#if stage === "create" && metadata && uploadInfo}
  <Subtitle>4. Create new ebook</Subtitle>
  <MetaCard {metadata} {uploadInfo} />
  <CreateCard
    ebookData={newEbookData}
    onCancel={onCreateCancel}
    {afterCreate} />
{/if}

<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";
  import { breadcrumb, lastEvent } from "$lib/globals.svelte";
  import type {
    EbookMetadata,
    MetaResult,
    OperationTicket,
    UploadInfo,
  } from "$lib/api";
  import Title from "$lib/components/title.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";

  breadcrumb.path = [{ name: "Upload Ebook", path: "/upload" }];

  type UploadStage = "upload" | "metadata" | "select" | "done";

  let stage: UploadStage = $state("upload");

  let fileSelected = $state(false);
  const id = $props.id();
  // svelte-ignore non_reactive_update
  let form: HTMLFormElement | null = null;
  let metaTicket: OperationTicket | null = null;
  let uploadInfo: UploadInfo | null = null;
  // svelte-ignore non_reactive_update
  let metadata: EbookMetadata | null = null;
  let error: string | null = $state(null);

  async function handleFileUpload(event: Event) {
    if (!form) throw new Error("No form found");
    event.preventDefault();
    const formData = new FormData(form);
    uploadInfo = await apiClient.uploadFile(formData);
    console.log(uploadInfo);
    metaTicket = await apiClient.retrieveMetadata(uploadInfo);
    console.log(metaTicket);
    stage = "metadata";
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    fileSelected = !!input.files && input.files?.length > 0; // Check if a file is selected
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
</script>

<Title>Upload file to new or existing ebook</Title>

{#if stage === "upload"}
  <Subtitle>1. Upload</Subtitle>
  <form
    bind:this={form}
    action="/upload"
    method="POST"
    enctype="multipart/form-data"
  >
    <div class="mb-4 space-y-4">
      <Label for="file-input-{id}">Upload a file</Label>
      <Input
        type="file"
        name="file"
        id="file-input-{id}"
        onchange={handleFileChange}
        class="w-auto"
      />
      <Button onclick={handleFileUpload} disabled={!fileSelected}>Upload</Button
      >
    </div>
  </form>
{/if}

{#if stage === "metadata"}
  <p>Waiting for metadata ...</p>
{/if}

{#if stage === "select"}
  <Subtitle>2. Select or create ebook</Subtitle>
  <pre>{JSON.stringify(metadata, null, 2)}</pre>
{/if}

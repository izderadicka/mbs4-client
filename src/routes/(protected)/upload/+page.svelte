<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";
  import { breadcrumb, lastEvent } from "$lib/globals.svelte";
  import type { OperationTicket, UploadInfo } from "$lib/api";

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
  let metadata: any = null;

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
    if (stage === "metadata") {
      const event = lastEvent();
      if (event && event.data) {
        metadata = event.data;
        stage = "select";
      }
    }
  });
</script>

<h1 class="text-4xl2xl font-bold mb-6">Upload file to new or existing ebook</h1>

{#if stage === "upload"}
  <h2 class="text-2xl font-bold mb-6">1. Upload</h2>
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
  <h2 class="text-2xl font-bold mb-6">2. Select or create ebook</h2>
  <pre>{JSON.stringify(metadata, null, 2)}</pre>
{/if}

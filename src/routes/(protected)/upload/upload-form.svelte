<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";
  import type { OperationTicket, UploadInfo } from "$lib/api";

  type Props = {
    onUpload: ({
      uploadInfo,
      metaTicket,
    }: {
      uploadInfo: UploadInfo;
      metaTicket: OperationTicket;
    }) => void;
    onError: (error: string) => void;
  };

  let { onUpload, onError }: Props = $props();
  let form: HTMLFormElement | null = null;
  const id = $props.id();
  let fileSelected = $state(false);

  async function handleFileUpload(event: Event) {
    if (!form) throw new Error("No form found");
    event.preventDefault();
    const formData = new FormData(form);
    try {
      let uploadInfo = await apiClient.uploadFile(formData);
      console.debug("Filed uploaded", uploadInfo);
      let metaTicket = await apiClient.retrieveMetadata(uploadInfo);
      console.debug("Metadata ticket", metaTicket);
      onUpload({ uploadInfo, metaTicket });
    } catch (e) {
      console.error("Error uploading file", e);
      onError(`Error uploading file: ${e}`);
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    fileSelected = !!input.files && input.files?.length > 0; // Check if a file is selected
  }

  export function reset() {
    fileSelected = false;
  }
</script>

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
      class="w-full"
    />
    <div class="flex justify-end gap-2">
      <Button onclick={handleFileUpload} disabled={!fileSelected}>Upload</Button
      >
    </div>
  </div>
</form>

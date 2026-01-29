<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";
  import type { EbookCoverInfo, UploadInfo } from "$lib/api";
  import { toast } from "svelte-sonner";
  import Title from "$lib/components/title.svelte";
  import { goto } from "$app/navigation";

  let form: HTMLFormElement | null = null;
  let fileSelected = $state(false);
  let { data } = $props();
  let ebook = $derived(data.ebook);

  async function handleFileUpload(event: Event) {
    if (!form) throw new Error("No form found");
    event.preventDefault();
    const formData = new FormData(form);
    try {
      const uploadInfo = await apiClient.uploadFile(formData);
      const coverUpdate: EbookCoverInfo = {
        ebook_id: ebook.id,
        ebook_version: ebook.version,
        cover_file: uploadInfo.final_path,
      };
      const newEbook = await apiClient.changeEbookCover(ebook.id, coverUpdate);
      await goto(`/ebook/${newEbook.id}`);
    } catch (e) {
      console.error("Error updating cover", e);
      toast.error("Error updating cover");
    }
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    fileSelected = !!input.files && input.files?.length > 0; // Check if a file is selected
  }

  let inputValue = $state("");
</script>

<Title>Upload Cover for Ebook:</Title>
<form
  bind:this={form}
  action="/upload"
  method="POST"
  enctype="multipart/form-data">
  <div class="mb-4 space-y-4">
    <Input type="hidden" name="kind" value="Cover" />
    <Label for="file-input">Upload a file</Label>
    <Input
      bind:value={inputValue}
      type="file"
      name="file"
      id="file-input"
      onchange={handleFileChange}
      class="w-full" />
    <div class="flex justify-end gap-2">
      <Button onclick={handleFileUpload} disabled={!fileSelected}
        >Upload</Button>
    </div>
  </div>
</form>

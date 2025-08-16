<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";
  import { breadcrumb } from "$lib/globals.svelte";

  breadcrumb.path = [{ name: "Upload Ebook", path: "/upload" }];

  let fileSelected = $state(false);
  const id = $props.id();
  let form: HTMLFormElement;

  async function handleFileUpload(event: Event) {
    event.preventDefault();
    const formData = new FormData(form);
    const response = await apiClient.uploadFile(formData);
    console.log(response);
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    fileSelected = !!input.files && input.files?.length > 0; // Check if a file is selected
  }
</script>

<h1 class="text-2xl font-bold mb-6">Upload</h1>
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
    <Button onclick={handleFileUpload} disabled={!fileSelected}>Upload</Button>
  </div>
</form>

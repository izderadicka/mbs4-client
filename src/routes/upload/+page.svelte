<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { apiClient } from "$lib/api/client";

  const id = $props.id();
  let form: HTMLFormElement;

  async function handleFileUpload(event: Event) {
    event.preventDefault();
    const formData = new FormData(form);
    const response = await apiClient.uploadFile(formData);
    console.log(response);
  }
</script>

<h1>Upload</h1>
<form
  bind:this={form}
  action="/upload"
  method="POST"
  enctype="multipart/form-data"
>
  <div class="mb-4">
    <Label for="file-input-{id}">Upload a file</Label>
    <Input type="file" name="file" id="file-input-{id}" />
    <Button onclick={handleFileUpload}>Upload</Button>
  </div>
</form>

<script lang="ts">
  import { superForm } from "sveltekit-superforms/client";
  import { zod4, zod4Client } from "sveltekit-superforms/adapters";
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  import { ebookSchema } from "$lib/schemas.js";

  const { ebookData } = $props();
  const form = superForm(ebookData, {
    SPA: true,
    dataType: "json",
    validators: zod4(ebookSchema),
  });
  const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
  <Form.Field {form} name="title">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Title</Form.Label>
        <Input {...props} bind:value={$formData.title} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Title of the ebook (without series)</Form.Description>
  </Form.Field>
</form>

<script lang="ts">
  import { superForm, defaults } from "sveltekit-superforms/client";
  import { zod4, zod4Client } from "sveltekit-superforms/adapters";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";

  import { ebookSchema } from "$lib/schemas.js";
  import { Textarea } from "./ui/textarea";

  let { ebookData } = $props();
  if (!ebookData) {
    ebookData = defaults(zod4(ebookSchema));
  }
  const form = superForm(ebookData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(ebookSchema),
    onUpdate: ({ form }) => {
      console.log(form);
    },
  });
  const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance class="space-y-6">
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

  <Form.Field {form} name="series-index">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Series Index</Form.Label>
        <Input {...props} bind:value={$formData.seriesIndex} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Index in series</Form.Description>
  </Form.Field>

  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Description</Form.Label>
        <Textarea {...props} bind:value={$formData.description} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Detailed description of ebook</Form.Description>
  </Form.Field>
  <Form.Button>Submit</Form.Button>
</form>

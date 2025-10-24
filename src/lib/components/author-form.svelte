<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { AuthorSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { Author, CreateAuthor, UpdateAuthor } from "$lib/api";

  let {
    authorData = null,
    onCreate = null,
  }: {
    authorData?: CreateAuthor | UpdateAuthor | null;
    onCreate?: null | ((author: CreateAuthor) => void);
  } = $props();
  if (!authorData) {
    authorData = {
      last_name: "",
    };
  }
  const form = superForm(authorData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(AuthorSchema),
    onUpdate: async ({ form }) => {
      console.log("Created series", form);
      if (onCreate) {
        onCreate({
          first_name: form.data.first_name,
          last_name: form.data.last_name,
          description: form.data.description,
        });
      }
    },
  });
  const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance class="space-y-6">
  <Form.Field {form} name="first_name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>First Name</Form.Label>
        <Input {...props} bind:value={$formData.first_name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description
      >First name of the author, including middle names (optional)</Form.Description
    >
  </Form.Field>

  <Form.Field {form} name="last_name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Last Name</Form.Label>
        <Input {...props} bind:value={$formData.last_name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description
      >Last name of the author, including nobiliary particle (de, le, von, etc.)</Form.Description
    >
  </Form.Field>

  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Description</Form.Label>
        <Textarea {...props} bind:value={$formData.description} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Detailed description of author</Form.Description>
  </Form.Field>
  <Form.Button>Submit</Form.Button>
</form>

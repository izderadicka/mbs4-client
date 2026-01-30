<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { AuthorSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { Author, CreateAuthor, UpdateAuthor } from "$lib/api";
  import FormButtons from "$lib/components/fragments/form-buttons.svelte";
  import DeleteDialog from "./delete-dialog.svelte";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import { on } from "svelte/events";

  let {
    authorData = null,
    afterCreate = undefined,
    afterDelete = undefined,
    afterUpdate = undefined,
    onCancel,
    onError = undefined,
    hasBooks = true,
  }: {
    authorData?: (CreateAuthor | UpdateAuthor) | null;
    afterCreate?: null | ((author: Author) => Promise<void>);
    afterUpdate?: null | ((author: Author) => Promise<void>);
    afterDelete?: null | ((id: number) => Promise<void>);
    onCancel: () => void | Promise<void>;
    onError?: (error: any) => void | Promise<void>;
    hasBooks?: boolean;
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
      if (!("id" in form.data) || !form.data.id) {
        const author: CreateAuthor = {
          last_name: form.data.last_name,
          first_name: form.data.first_name,
          description: form.data.description,
        };
        try {
          const newAuthor = await apiClient.createAuthor(author);
          await afterCreate?.(newAuthor);
        } catch (error) {
          console.error("Failed to create author", error);
          toast.error("Failed to create author");
          onError?.(error);
        }
      } else {
        const author: UpdateAuthor = {
          id: form.data.id,
          version: form.data.version,
          last_name: form.data.last_name,
          first_name: form.data.first_name,
          description: form.data.description,
        };
        try {
          const updatedAuthor = await apiClient.updateAuthor(author);
          await afterUpdate?.(updatedAuthor);
        } catch (error) {
          console.error("Failed to update author", error);
          toast.error("Failed to update author");
          onError?.(error);
        }
      }
    },
  });
  const { form: formData, enhance } = form;

  let deleteDialog: DeleteDialog;

  async function onDelete() {
    if ("id" in $formData) {
      deleteDialog.openDialog({
        id: $formData.id,
        name: "author",
        detail: $formData.last_name,
      });
    } else {
      console.error("Author id not provided");
    }
  }
  async function onConfirmedDelete(id: number) {
    try {
      await apiClient.deleteAuthor(id);
      await afterDelete?.(id);
    } catch (error) {
      console.error("Failed to delete author", error);
      toast.error("Failed to delete author");
    }
  }
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
      >First name of the author, including middle names (optional)</Form.Description>
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
      >Last name of the author, including nobiliary particle (de, le, von, etc.)</Form.Description>
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
  <FormButtons
    id={"id" in $formData ? $formData.id : null}
    deleteDisabled={hasBooks}
    {onCancel}
    {onDelete} />
</form>

<DeleteDialog bind:this={deleteDialog} {onConfirmedDelete} />

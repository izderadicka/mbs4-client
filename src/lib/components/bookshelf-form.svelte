<script lang="ts">
  import { superForm, defaults } from "sveltekit-superforms/client";
  import { zod4, zod4Client } from "sveltekit-superforms/adapters";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { BookshelfSchema } from "$lib/schemas.js";
  import FormButtons from "$lib/components/fragments/form-buttons.svelte";
  import DeleteDialog from "$lib/components/delete-dialog.svelte";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import type { Bookshelf, CreateBookshelf, UpdateBookshelf } from "$lib/api";
  import Checkbox from "./ui/checkbox/checkbox.svelte";

  let {
    bookshelfData = null,
    afterCreate = undefined,
    afterDelete = undefined,
    afterUpdate = undefined,
    onCancel,
    onError = undefined,
  }: {
    bookshelfData?: (CreateBookshelf | UpdateBookshelf) | null;
    afterCreate?: null | ((bookshelf: Bookshelf) => Promise<void>);
    afterUpdate?: null | ((bookshelf: Bookshelf) => Promise<void>);
    afterDelete?: null | ((id: number) => Promise<void>);
    onCancel: () => void | Promise<void>;
    onError?: (error: any) => void | Promise<void>;
  } = $props();

  if (!bookshelfData) {
    bookshelfData = {
      name: "",
      public: false,
    };
  }

  const form = superForm(bookshelfData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(BookshelfSchema),
    onUpdate: async ({ form }) => {
      if (!form.valid) {
        return;
      }
      if ("id" in form.data && form.data.id != null) {
        const bookshelf: UpdateBookshelf = {
          id: form.data.id,
          version: form.data.version,
          name: form.data.name,
          description: form.data.description,
          public: form.data.public,
        };
        try {
          const updatedBookshelf = await apiClient.updateBookshelf(bookshelf);
          await afterUpdate?.(updatedBookshelf);
        } catch (error) {
          console.error("Failed to update bookshelf", error);
          toast.error("Failed to update bookshelf");
          onError?.(error);
        }
      } else {
        const bookshelf: CreateBookshelf = {
          name: form.data.name,
          description: form.data.description,
          public: form.data.public,
        };
        try {
          const newBookshelf = await apiClient.createBookshelf(bookshelf);
          await afterCreate?.(newBookshelf);
        } catch (error) {
          console.error("Failed to create bookshelf", error);
          toast.error("Failed to create bookshelf");
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
        name: "bookshelf",
        detail: $formData.name,
      });
    } else {
      console.error("Bookshelf id not provided");
    }
  }
  async function onConfirmedDelete(id: number) {
    try {
      await apiClient.deleteBookshelf(id);
      await afterDelete?.(id);
    } catch (error) {
      console.error("Failed to delete bookshelf", error);
      toast.error("Failed to delete bookshelf");
    }
  }
</script>

<form method="POST" use:enhance class="space-y-6">
  <Form.Field {form} name="name">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Name</Form.Label>
        <Input {...props} bind:value={$formData.name} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Name of the bookshelf</Form.Description>
  </Form.Field>

  <Form.Field {form} name="public">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Public</Form.Label>
        <Checkbox {...props} bind:checked={$formData.public} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description
      >Whether the bookshelf should be publicly visible</Form.Description>
  </Form.Field>

  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Description</Form.Label>
        <Textarea {...props} bind:value={$formData.description} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Description of the bookshelf</Form.Description>
  </Form.Field>
  <FormButtons
    id={"id" in $formData ? $formData.id : null}
    {onCancel}
    {onDelete} />
</form>

<DeleteDialog bind:this={deleteDialog} {onConfirmedDelete} />

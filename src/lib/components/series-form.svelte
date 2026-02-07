<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { SeriesSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { CreateSeries, Series, UpdateSeries } from "$lib/api";
  import FormButtons from "$lib/components/fragments/form-buttons.svelte";
  import DeleteDialog from "./delete-dialog.svelte";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";

  let {
    seriesData = null,
    afterCreate = undefined,
    afterDelete = undefined,
    afterUpdate = undefined,
    onCancel,
    onError = undefined,
    hasBooks = true,
  }: {
    seriesData?: CreateSeries | UpdateSeries | null;
    afterCreate?: null | ((author: Series) => Promise<void>);
    afterUpdate?: null | ((author: Series) => Promise<void>);
    afterDelete?: null | ((id: number) => Promise<void>);
    onCancel: () => void | Promise<void>;
    onError?: (error: any) => void | Promise<void>;
    hasBooks?: boolean;
  } = $props();
  if (!seriesData) {
    seriesData = {
      title: "",
    };
  }
  const form = superForm(seriesData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(SeriesSchema),
    onUpdate: async ({ form }) => {
      if (!form.valid) {
        return;
      }
      if ("id" in form.data && form.data.id != null) {
        const series: UpdateSeries = {
          id: form.data.id,
          version: form.data.version,
          title: form.data.title,
          description: form.data.description,
        };
        try {
          const updatedSeries = await apiClient.updateSeries(series);
          await afterUpdate?.(updatedSeries);
        } catch (error) {
          console.error("Failed to update series", error);
          toast.error("Failed to update series");
          onError?.(error);
        }
      } else {
        const series: CreateSeries = {
          title: form.data.title,
          description: form.data.description,
        };
        try {
          const newSeries = await apiClient.createSeries(series);
          await afterCreate?.(newSeries);
        } catch (error) {
          console.error("Failed to create series", error);
          toast.error("Failed to create series");
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
        name: "series",
        detail: $formData.title,
      });
    } else {
      console.error("Author id not provided");
    }
  }
  async function onConfirmedDelete(id: number) {
    try {
      await apiClient.deleteSeries(id);
      await afterDelete?.(id);
    } catch (error) {
      console.error("Failed to delete author", error);
      toast.error("Failed to delete author");
    }
  }
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
    <Form.Description>Title of the series</Form.Description>
  </Form.Field>

  <Form.Field {form} name="description">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Description</Form.Label>
        <Textarea {...props} bind:value={$formData.description} />
      {/snippet}
    </Form.Control>
    <Form.FieldErrors />
    <Form.Description>Detailed description of series</Form.Description>
  </Form.Field>
  <FormButtons
    id={"id" in $formData ? $formData.id : null}
    deleteDisabled={hasBooks}
    {onCancel}
    {onDelete} />
</form>

<DeleteDialog bind:this={deleteDialog} {onConfirmedDelete} />

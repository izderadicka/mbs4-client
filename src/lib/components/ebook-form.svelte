<script lang="ts">
  import { superForm, defaults } from "sveltekit-superforms/client";
  import { zod4, zod4Client } from "sveltekit-superforms/adapters";
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";

  import { EbookSchema } from "$lib/schemas.js";
  import { Textarea } from "./ui/textarea";
  import SeriesField from "./fields/series-field.svelte";
  import LanguageField from "./fields/language-field.svelte";
  import GenreField from "./fields/genre-field.svelte";
  import AuthorField from "./fields/author-field.svelte";
  import Button from "./ui/button/button.svelte";
  import type { CreateEbook, Ebook } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import FormButtons from "./fragments/form-buttons.svelte";

  type Props = {
    ebookData?: any;
    afterCreate?: (ebook: Ebook) => Promise<void>;
    onCancel: () => void | Promise<void>;
  };

  let { ebookData, afterCreate, onCancel }: Props = $props();
  if (!ebookData) {
    ebookData = defaults(zod4(EbookSchema));
  }
  const form = superForm(ebookData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(EbookSchema),
    onUpdate: async ({ form, cancel }) => {
      console.debug("Updated form", form);
      if (!form.valid) return;

      if (!form.data.id) {
        const ebookData: CreateEbook = {
          title: form.data.title,
          authors: form.data.authors?.map((a: { id: number }) => a.id),
          series_id: form.data.series?.id,
          series_index: form.data.series_index,
          description: form.data.description,
          language_id: form.data.language?.id,
          genres: form.data.genres?.map((g: { id: number }) => g.id),
        };
        try {
          const ebook = await apiClient.createEbook(ebookData);
          if (afterCreate) {
            await afterCreate(ebook);
          }
        } catch (error) {
          cancel();
          console.error("Failed to create ebook", error);
          toast.error("Failed to create ebook");
        }
      }
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

  <AuthorField {form} bind:value={$formData.authors} />

  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <div class="md:col-span-3">
      <SeriesField {form} bind:value={$formData.series} />
    </div>

    <div class="md:col-span-1">
      <Form.Field {form} name="series_index">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Series Index</Form.Label>
            <Input {...props} bind:value={$formData.series_index} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
        <Form.Description>Index in series</Form.Description>
      </Form.Field>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="md:col-span-1">
      <LanguageField {form} bind:value={$formData.language} />
    </div>

    <div class="md:col-span-1">
      <GenreField {form} bind:value={$formData.genres} />
    </div>
  </div>

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
  <FormButtons id={$formData.id} {onCancel} />
</form>

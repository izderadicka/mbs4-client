<script lang="ts">
  import * as Form from "$lib/components/ui/form";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { SeriesSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import type { CreateSeries, UpdateSeries } from "$lib/api";

  let {
    seriesData = null,
    onCreate = null,
  }: {
    seriesData?: CreateSeries | UpdateSeries | null;
    onCreate?: null | ((series: CreateSeries) => void);
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
      console.log("Created series", form);
      if (onCreate) {
        onCreate({
          title: form.data.title,
        });
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
  <Form.Button>Submit</Form.Button>
</form>

<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";
  import { Field } from "formsnap";
  import type { SuperForm } from "sveltekit-superforms";
  interface Language {
    id: number;
    name: string;
    code: string;
  }

  let {
    value = $bindable(),
    form,
  }: { value: Language | null; form: SuperForm<any> } = $props();

  let languages: Language[] = $state([]);
  const languagesMap: Record<string, Language> = $derived(
    languages.reduce((acc, l) => ({ ...acc, [l.code]: l }), {})
  );
  let selectedCode = $state("");
  onMount(async () => {
    languages = await apiClient.listLanguages();
  });
  // sync the selected code with the value
  $effect(() => {
    if (selectedCode) {
      value = languagesMap[selectedCode];
    }
  });

  $effect(() => {
    if (!value) {
      selectedCode = "";
    }
  });
</script>

<Form.Field {form} name="language">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Language</Form.Label>

      <Select.Root bind:value={selectedCode} type="single" {...props}>
        <Select.Trigger>
          {value?.name || "Select a language"}
        </Select.Trigger>
        <Select.Content>
          {#each languages as language}
            <Select.Item
              value={language.code}
              onselect={() => {
                console.debug("selected", language);
              }}>{language.name}</Select.Item
            >
          {/each}
        </Select.Content>
      </Select.Root>
    {/snippet}
  </Form.Control>

  <Form.FieldErrors />
  <Form.Description>Language of the ebook</Form.Description>
</Form.Field>

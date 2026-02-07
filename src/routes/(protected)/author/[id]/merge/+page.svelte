<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import { formatName } from "$lib/utils";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { MergeDirection } from "$lib/types/app.js";
  import MergeDirectionRadio from "$lib/components/fragments/merge-direction-radio.svelte";
  import { superForm } from "sveltekit-superforms";
  import AuthorField from "$lib/components/fields/author-field.svelte";
  import type { AuthorShort } from "$lib/api/index.js";
  import MergeButtons from "$lib/components/fragments/merge-buttons.svelte";
  import { apiClient } from "$lib/api/client.js";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  let { data } = $props();
  let author = $derived(data.author);
  let otherAuthor = $state<AuthorShort | null>(null);
  let otherAuthorBooks = $derived(fetchAuthorBooks(otherAuthor?.id));

  // svelte-ignore state_referenced_locally
  breadcrumb.path = [
    { name: "Authors", path: "/author" },
    { name: formatName(author) },
    { name: "Merge" },
  ];

  let mergeDirection: MergeDirection = $state("from");
  let inputData = { authors: [] };
  const form = superForm(inputData, {
    SPA: true,
    dataType: "json",
    validators: false,
    onChange: async () => {
      if ($formData.authors && $formData.authors.length > 0) {
        otherAuthor = $formData.authors[0];
      } else {
        otherAuthor = null;
      }
    },
  });
  const { form: formData } = form;

  async function fetchAuthorBooks(id: number | undefined) {
    if (id == null) {
      return null;
    }
    return await apiClient.listAuthorEbooks(id, { page_size: 3 });
  }

  async function onCancel() {
    await goto("/author/" + author.id);
  }

  async function onMerge() {
    let finalId = null;
    try {
      if (mergeDirection === "to") {
        await apiClient.mergeAuthor(author.id, otherAuthor!.id);
        finalId = otherAuthor!.id;
      } else {
        await apiClient.mergeAuthor(otherAuthor!.id, author.id);
        finalId = author.id;
      }
    } catch (error) {
      console.error("Failed to merge authors", error);
      toast.error("Failed to merge authors");
      return;
    }
    if (finalId) await goto(`/author/${finalId}`);
  }
</script>

<Title>Merge Author: {formatName(author)}</Title>
<AuthorField
  {form}
  bind:value={$formData.authors}
  label="Other Author"
  description="Select Author for merge operation"
  disableCreate={true}
  selectOneOnly={true}
  omitAuthorId={author.id} />

<MergeDirectionRadio bind:mergeDirection entityName="Author" />

{#if otherAuthor}
  <Title>Other Author: {formatName(otherAuthor)}</Title>
  {#await otherAuthorBooks then books}
    {#if books}
      <p>
        Author(id: {otherAuthor.id}) has {books.total} books, like {books.rows
          .map((b) => b.title)
          .join(", ")}
      </p>
    {/if}
  {/await}
{/if}

<MergeButtons
  {onCancel}
  {onMerge}
  disabled={otherAuthor === null}
  {mergeDirection} />

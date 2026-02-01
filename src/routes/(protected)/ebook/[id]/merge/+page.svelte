<script lang="ts">
  import type { Ebook, EbookDoc } from "$lib/api";
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import Title from "$lib/components/title.svelte";
  import Label from "$lib/components/ui/label/label.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import EbookInfo from "../ebook-info.svelte";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { goto } from "$app/navigation";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import type { MergeDirection } from "$lib/types/app";

  let { data } = $props();
  let ebook = $derived(data.ebook);
  breadcrumb.path = [
    { name: "Ebooks", path: "/ebook" },
    // svelte-ignore state_referenced_locally
    { name: ebook.title, path: `/ebook/${ebook.id}` },
    { name: "Merge" },
  ];

  let otherEbook: Ebook | null = $state(null);
  let mergeDirection: MergeDirection = $state("from");

  async function onSelect(ebookId: number) {
    try {
      otherEbook = await apiClient.getEbook(ebookId);
    } catch (error) {
      console.error("Failed to get other ebook", error);
      toast.error("Failed to get other ebook");
    }
  }

  async function onMerge() {
    let finalId = null;
    try {
      if (mergeDirection === "to") {
        await apiClient.mergeEbook(ebook.id, otherEbook!.id);
        finalId = otherEbook!.id;
      } else {
        await apiClient.mergeEbook(otherEbook!.id, ebook.id);
        finalId = ebook.id;
      }
    } catch (error) {
      console.error("Failed to merge ebooks", error);
      toast.error("Failed to merge ebooks");
      return;
    }
    await goto(`/ebook/${finalId}`);
  }

  async function onCancel() {
    await goto(`/ebook/${ebook.id}`);
  }
</script>

<EbookInfo {ebook} />

<Label>Search Other Ebook</Label>
<BookAutocomplete {onSelect} skip_ids={[ebook.id]} />

<RadioGroup.Root bind:value={mergeDirection}>
  <div class="flex items-center space-x-2">
    <RadioGroup.Item value="from" id="option-merge-from" />
    <Label for="option-merge-from">Merge other ebook here</Label>
  </div>
  <div class="flex items-center space-x-2">
    <RadioGroup.Item value="to" id="option-merge-to" />
    <Label for="option-merge-to">Merge to other ebook</Label>
  </div>
</RadioGroup.Root>

{#if otherEbook}
  <EbookInfo ebook={otherEbook} />
{/if}
<div class="flex justify-end gap-20">
  <div class="flex gap-2">
    <Button variant="outline" onclick={onCancel}>Cancel</Button>
    <Button onclick={onMerge} disabled={otherEbook === null}
      >Merge {#if mergeDirection === "from"}From{:else}To{/if}</Button>
  </div>
</div>

<script lang="ts">
  import type { Ebook, EbookDoc } from "$lib/api";
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import { Label } from "$lib/components/ui/label/index.js";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import EbookInfo from "../ebook-info.svelte";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { goto } from "$app/navigation";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import type { MergeDirection } from "$lib/types/app";
  import MergeDirectionRadio from "$lib/components/fragments/merge-direction-radio.svelte";
  import MergeButtons from "$lib/components/fragments/merge-buttons.svelte";

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

<MergeDirectionRadio bind:mergeDirection entityName="Ebook" />

{#if otherEbook}
  <EbookInfo ebook={otherEbook} />
{/if}
<MergeButtons
  {onCancel}
  {onMerge}
  disabled={otherEbook === null}
  {mergeDirection} />

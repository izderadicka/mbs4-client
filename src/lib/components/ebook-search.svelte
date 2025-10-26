<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  import * as Item from "$lib/components/ui/item";
  import type { EbookDoc, EbookSearchItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import CoverIcon from "./fragments/cover-icon.svelte";
  import { onMount, type Snippet } from "svelte";

  type External = {
    initialQuery?: string;
    ebooks: EbookSearchItem[];
    handleSubmit: (q: string) => void;
  };

  type Props = {
    actionName?: string;
    maxItems?: number;
    item?: Snippet<[EbookSearchItem]>;
    onSelect: (ebook: EbookDoc) => void;
    externalControl?: External;
  };

  let query = $state("");
  let ebooks: EbookSearchItem[] = $state([]);

  let {
    actionName = "Select",
    onSelect,
    item = undefined,
    maxItems = 10,
    externalControl = undefined,
  } = $props();

  export async function submitSearch(q?: string) {
    if (q) {
      query = q;
    }
    if (!query.trim()) return;

    if (externalControl) {
      externalControl.handleSubmit(query);
    } else {
      try {
        ebooks = await apiClient.searchEbook(query, maxItems);
      } catch (error) {
        console.error("Failed to search ebooks", error);
        toast.error("Failed to search ebooks");
      }
    }
  }

  $effect(() => {
    if (externalControl) {
      ebooks = externalControl.ebooks;
      query = externalControl.initialQuery ?? "";
    }
  });
</script>

<div class="relative w-full">
  <Input
    bind:value={query}
    placeholder="Search ebooks..."
    class="w-full pr-10"
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
    }}
  /><Button
    type="button"
    variant="ghost"
    aria-label="Submit Search"
    class="absolute right-0 top-1/2 -translate-y-1/2 cursor-pointer"
    onclick={() => submitSearch()}
    onkeydown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
    }}><SearchIcon /></Button
  >
</div>

<div class="mt-2">
  {#each ebooks as ebook}
    {#if item}
      {@render item(ebook)}
    {:else}
      <Item.Root variant="outline" class="mb-4">
        <Item.Header class="truncate font-bold"
          >{ebook.doc.Ebook.title}</Item.Header
        >
        <Item.Media>
          <CoverIcon />
        </Item.Media>
        <Item.Content>
          <Item.Title
            >{ebook.doc.Ebook.authors.map((a) => a.name).join(", ")}</Item.Title
          >
          <Item.Description
            >{#if ebook.doc.Ebook.series}
              {`${ebook.doc.Ebook.series} #${ebook.doc.Ebook.series_index}`}
            {/if}</Item.Description
          >
        </Item.Content>
        {#if actionName}
          <Item.Actions>
            <Button variant="outline" onclick={() => onSelect(ebook.doc.Ebook)}
              >{actionName}</Button
            >
          </Item.Actions>
        {/if}
      </Item.Root>
    {/if}
  {/each}
</div>

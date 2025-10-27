<script lang="ts">
  import type { EbookDoc, EbookMetadata } from "$lib/api";
  import * as Card from "$lib/components/ui/card";
  import EbookSearch from "$lib/components/ebook-search.svelte";
  import { onMount } from "svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  let { metadata }: { metadata: EbookMetadata | null } = $props();

  let searchComponent: EbookSearch;
  let onSelect = (ebook: EbookDoc) => {
    console.log(ebook);
  };

  onMount(() => {
    if (metadata) {
      let query = `${metadata.title}`;
      if (metadata.authors && metadata.authors.length > 0) {
        query += ` ${metadata.authors.map((a) => `${a.first_name} ${a.last_name}`).join(" ")}`;
      }
      if (metadata.series) {
        query += ` ${metadata.series.title}`;
      }
      searchComponent.submitSearch(query);
    }
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Existing Ebooks</Card.Title>
    <Card.Description>Find matching existing ebook</Card.Description>
  </Card.Header>
  <Card.Content>
    <EbookSearch
      bind:this={searchComponent}
      {onSelect}
      maxItems={5}
      actionName="Add to this"
    />
    <Button variant="outline" class="w-full mt-4"
      >Or create completely new</Button
    >
  </Card.Content>
</Card.Root>

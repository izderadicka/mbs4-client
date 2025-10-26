<script lang="ts">
  import type { EbookMetadata } from "$lib/api";
  import * as Card from "$lib/components/ui/card";
  import MetaTable from "./meta-table.svelte";

  let { metadata }: { metadata: EbookMetadata | null } = $props();
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Ebook Metadata</Card.Title>
    <Card.Description>Metadata extracted from uploaded file</Card.Description>
  </Card.Header>
  <Card.Content>
    <MetaTable {metadata} />
  </Card.Content>
</Card.Root>

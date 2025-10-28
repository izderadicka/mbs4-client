<script lang="ts">
  import type { Ebook, EbookMetadata } from "$lib/api";
  import EbookForm from "$lib/components/ebook-form.svelte";
  import * as Card from "$lib/components/ui/card";
  import type { EbookFormData } from "$lib/schemas";
  import { metaToEbook } from "./logic";
  const {
    ebookData,
    onCancel,
    afterCreate,
  }: {
    ebookData: EbookFormData | null;
    onCancel: () => void;
    afterCreate: (ebook: Ebook) => Promise<void>;
  } = $props();
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Create New Ebook</Card.Title>
    <Card.Description
      >Form is prefilled with metadata, but they can be messy, so please verify</Card.Description>
  </Card.Header>
  <Card.Content>
    <EbookForm {ebookData} {onCancel} {afterCreate} />
  </Card.Content>
</Card.Root>

<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Ebook } from "$lib/api";
  import EbookForm from "$lib/components/ebook-form.svelte";
  import Title from "$lib/components/title.svelte";

  let ebookData = null;

  async function afterCreate(ebook: Ebook) {
    await goto(`/ebook/${ebook.id}`);
  }
</script>

<Title>Create New Ebook</Title>
<p class="italic text-muted-foreground">
  But better way is to create new ebook during file upload
</p>
<EbookForm {ebookData} {afterCreate} />

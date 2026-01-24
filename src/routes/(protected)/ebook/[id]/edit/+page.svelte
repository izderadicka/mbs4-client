<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Ebook } from "$lib/api";
  import EbookForm from "$lib/components/ebook-form.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  const { data } = $props();
  let ebookData = $derived(data.ebook);

  // svelte-ignore state_referenced_locally
  breadcrumb.path = [
    { name: "Ebooks", path: "/ebook" },
    { name: ebookData.title, path: `/ebook/${ebookData.id}` },
    { name: "Edit" },
  ];

  async function afterUpdate(ebook: Ebook) {
    console.debug("Updated ebook", ebook);
    await goto(`/ebook/${ebook.id}`);
  }

  async function onCancel() {
    await goto(`/ebook/${ebookData.id}`);
  }
</script>

<Title>Edit Ebook Info</Title>
<EbookForm {ebookData} {onCancel} {afterUpdate} />

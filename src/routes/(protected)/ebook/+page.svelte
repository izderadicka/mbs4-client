<script lang="ts">
  import { breadcrumb, hasRole } from "$lib/globals.svelte.js";
  import Title from "$lib/components/title.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import EbookList from "$lib/components/ebook-list.svelte";
  import AddButton from "$lib/components/fragments/add-button.svelte";

  const { data } = $props();

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }];
</script>

<Title>All Ebooks</Title>
<div class="flex">
  <AddButton entity="ebook" />
</div>

<EbookList ebooks={data.ebooks} sort={data.sort} genres={data.genres} />

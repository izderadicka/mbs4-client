<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte.js";
  import Title from "$lib/components/title.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import AddIcon from "@lucide/svelte/icons/plus";
  import EbookList from "$lib/components/ebook-list.svelte";

  const { data } = $props();
  const ebooks = $derived(data.ebooks);

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }];
</script>

<Title>All Ebooks</Title>

<div class="flex">
  <Button class="ml-auto" href="/ebook/new"
    ><AddIcon /><span class="ml-2 hidden md:inline">Add</span></Button>
</div>

<EbookList {ebooks} />

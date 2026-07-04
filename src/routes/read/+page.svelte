<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { appUser } from "$lib/globals.svelte";
  import { apiClient } from "$lib/api/client";
  import { formatName } from "$lib/utils";
  import Reader from "$lib/components/reader/reader.svelte";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();

  let file: File | null = $state(null);
  let fileError: string | null = $state(null);
  const error = $derived(data.error ?? fileError);

  const title = $derived(data.ebook?.title ?? "");
  const author = $derived(
    data.ebook?.authors?.map(formatName).join(", ") ?? "",
  );

  // File name matters to foliate-js format detection (fb2, cbz), so make
  // sure it ends with the expected extension
  function bookFileName(location: string, ext: string): string {
    let name = location.split("/").pop() || "book";
    if (ext && !name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      name += `.${ext}`;
    }
    return name;
  }

  onMount(async () => {
    if (!appUser.user) {
      goto("/login");
      return;
    }
    if (!data.item) {
      return;
    }
    try {
      const blob = await apiClient.loadBookFile(data.kind, data.item.location);
      file = new File(
        [blob],
        bookFileName(data.item.location, data.item.format_extension),
      );
    } catch (e) {
      console.error("Failed to load ebook file", e);
      fileError = e instanceof Error ? e.message : "Failed to load ebook file";
    }
  });
</script>

<svelte:head>
  <title>{title || "Reader"}</title>
</svelte:head>

{#if appUser.user}
  {#if file && data.item}
    <Reader
      {file}
      storageKey={`mbs4.reading.${data.kind}.${data.item.id}`}
      {title}
      {author} />
  {:else if error}
    <div class="flex h-dvh items-center justify-center p-8">
      <p class="text-destructive text-center">{error}</p>
    </div>
  {:else}
    <div class="flex h-dvh flex-col items-center justify-center gap-4">
      <Spinner class="size-8" />
      <p class="text-muted-foreground text-sm">
        Loading {title || "ebook"} ...
      </p>
    </div>
  {/if}
{/if}

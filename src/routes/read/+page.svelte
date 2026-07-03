<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { appUser } from "$lib/globals.svelte";
  import { apiClient } from "$lib/api/client";
  import Reader from "$lib/components/reader/reader.svelte";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import type { PageProps } from "./$types";

  const { data }: PageProps = $props();

  let file: File | null = $state(null);
  let error: string | null = $state(null);

  // File name matters to foliate-js format detection (fb2, cbz), so make
  // sure it ends with the expected extension
  function bookFileName(): string {
    let name = data.path.split("/").pop() || "book";
    const ext = data.ext.toLowerCase();
    if (ext && !name.toLowerCase().endsWith(`.${ext}`)) {
      name += `.${ext}`;
    }
    return name;
  }

  onMount(async () => {
    if (!appUser.user) {
      goto("/login");
      return;
    }
    if (!data.path) {
      error = "Missing ebook file reference";
      return;
    }
    try {
      const blob = await apiClient.loadBookFile(data.kind, data.path);
      file = new File([blob], bookFileName());
    } catch (e) {
      console.error("Failed to load ebook file", e);
      error = e instanceof Error ? e.message : "Failed to load ebook file";
    }
  });
</script>

<svelte:head>
  <title>{data.title || "Reader"}</title>
</svelte:head>

{#if appUser.user}
  {#if file}
    <Reader
      {file}
      storageKey={`mbs4.reading.${data.kind}.${data.path}`}
      fallbackTitle={data.title} />
  {:else if error}
    <div class="flex h-dvh items-center justify-center p-8">
      <p class="text-destructive text-center">{error}</p>
    </div>
  {:else}
    <div class="flex h-dvh flex-col items-center justify-center gap-4">
      <Spinner class="size-8" />
      <p class="text-muted-foreground text-sm">
        Loading {data.title || "ebook"} ...
      </p>
    </div>
  {/if}
{/if}

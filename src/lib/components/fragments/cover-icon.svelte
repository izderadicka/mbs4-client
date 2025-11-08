<script lang="ts">
  import NoCoverIcon from "@lucide/svelte/icons/book-x";
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";

  let notFound = $state(false);
  let imageUrl = $state<string | null>(null);
  let iconElement = $state<HTMLElement | null>(null);

  type Props = {
    ebookId: number;
    size?: number;
  };
  let { ebookId, size = 64 }: Props = $props();

  const maxHeight = $derived(Math.round(size * 1.4142));

  onMount(() => {
    const abort = new AbortController();
    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !imageUrl && !notFound) {
          try {
            let imageBlob = await apiClient.loadIcon(ebookId, abort.signal);
            if (imageBlob) {
              imageUrl = URL.createObjectURL(imageBlob);
            } else {
              notFound = true;
              imageUrl = null;
            }
          } catch (error) {
            console.error(error);
          }
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );
    if (iconElement) {
      observer.observe(iconElement);
    }

    return () => {
      observer.disconnect();
      abort.abort();
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  });
</script>

<div
  class="block items-center justify-center"
  style="width: {size}px; max-height: {maxHeight}px;"
  bind:this={iconElement}>
  {#if imageUrl}
    <img src={imageUrl} alt="" bind:this={iconElement} />
  {:else if notFound}
    <NoCoverIcon size={64} color="var(--color-muted)" />
  {/if}
</div>

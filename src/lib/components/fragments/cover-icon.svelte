<script lang="ts">
  import NoCoverIcon from "@lucide/svelte/icons/book-x";
  import { apiClient } from "$lib/api/client";
  import { onDestroy, onMount } from "svelte";

  let notFound = $state(false);
  let imageUrl = $state<string | null>(null);
  let iconElement = $state<HTMLElement | null>(null);
  let loadedIconId: number | null = null;
  let isVisible = false;

  type Props = {
    ebookId: number;
    size?: number;
  };
  let { ebookId, size = 64 }: Props = $props();

  const maxHeight = $derived(Math.round(size * 1.4142));
  let abort: AbortController | null = null;
  let observer: IntersectionObserver | null = null;

  async function loadImage() {
    abort?.abort();
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    abort = new AbortController();
    try {
      let imageBlob = await apiClient.loadIcon(ebookId, abort?.signal);
      if (imageBlob) {
        imageUrl = URL.createObjectURL(imageBlob);
      } else {
        notFound = true;
        imageUrl = null;
      }
    } catch (error) {
      console.error(error);
    }
    loadedIconId = ebookId;
  }

  $effect(() => {
    if (iconElement) {
      console.log(`ICON EFFECT on ${ebookId}`);
      if (!observer) {
        observer = new IntersectionObserver(
          async (entries) => {
            const entry = entries[0];
            isVisible = entry.isIntersecting;
            if (entry.isIntersecting && !imageUrl && !notFound) {
              await loadImage();
            }
          },
          { threshold: 0.1, rootMargin: "200px" },
        );
        observer.observe(iconElement);
      }

      if (ebookId !== loadedIconId) {
        if (isVisible) {
          loadImage();
        } else {
          notFound = false;
          if (imageUrl) {
            URL.revokeObjectURL(imageUrl);
            imageUrl = null;
          }
        }
      }
    }
  });

  onMount(() => {});

  onDestroy(() => {
    observer?.disconnect();
    abort?.abort();
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
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

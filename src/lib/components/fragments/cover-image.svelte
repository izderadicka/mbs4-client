<script lang="ts">
  import { apiClient } from "$lib/api/client";
  import NoCoverIcon from "@lucide/svelte/icons/book-x";
  import XIcon from "@lucide/svelte/icons/x";
  import * as Dialog from "$lib/components/ui/dialog";
  import type { HTMLAttributes } from "svelte/elements";

  type DivAttributes = HTMLAttributes<HTMLDivElement>;
  let {
    file,
    uploaded = false,
    zoomable = false,
    ...attrs
  }: {
    file?: string | null;
    uploaded?: boolean;
    zoomable?: boolean;
  } & DivAttributes = $props();

  let src = $state<string | null>(null);
  let zoomOpen = $state(false);
  let abort: AbortController | null = null;

  function closeOnClickOutsideImage(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      zoomOpen = false;
    }
  }

  $effect(() => {
    if (!file) {
      src = null;
      return;
    }
    if (abort) abort.abort();
    // if (src) URL.revokeObjectURL(src);
    abort = new AbortController();
    let future: Promise<Blob | null>;
    if (uploaded) {
      future = apiClient.loadExtractedCover(file, abort.signal);
    } else {
      future = apiClient.loadCover(file, abort.signal);
    }

    future
      .then((imageBlob) => {
        abort = null;
        if (imageBlob) {
          src = URL.createObjectURL(imageBlob);
        }
      })
      .catch((e) => console.error(e));

    return () => {
      abort?.abort();
      if (src) {
        URL.revokeObjectURL(src);
        src = null;
      }
    };
  });
</script>

<div class="block items-center justify-center w-sm" {...attrs}>
  {#if src}
    {#if zoomable}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <img
        {src}
        alt="Book cover"
        class="cursor-zoom-in"
        onclick={() => (zoomOpen = true)} />
    {:else}
      <img {src} alt="Book cover" />
    {/if}
  {:else}
    <NoCoverIcon size={64} color="var(--color-muted)" />{/if}
</div>

{#if zoomable && src}
  <Dialog.Root bind:open={zoomOpen}>
    <Dialog.Content
      showCloseButton={false}
      onclick={closeOnClickOutsideImage}
      class="flex h-[92vh] max-h-[92vh] w-[92vw] max-w-[92vw] items-center
        justify-center p-2 sm:max-w-[92vw] sm:p-4">
      <Dialog.Title class="sr-only">Book cover</Dialog.Title>
      <Dialog.Description class="sr-only">
        Full size book cover. Press Escape, click the close button or click
        outside the image to close.
      </Dialog.Description>
      <img
        {src}
        alt="Book cover"
        class="h-full max-h-[1200px] w-auto max-w-full object-contain" />
      <Dialog.Close
        class="bg-background/80 hover:bg-background focus-visible:ring-ring
          absolute end-2 top-2 rounded-full p-1.5 opacity-80
          transition-opacity hover:opacity-100 focus-visible:outline-hidden
          focus-visible:ring-2">
        <XIcon class="size-5" />
        <span class="sr-only">Close</span>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Root>
{/if}

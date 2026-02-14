<script lang="ts">
  import { apiClient } from "$lib/api/client";
  import NoCoverIcon from "@lucide/svelte/icons/book-x";
  import type { HTMLAttributes } from "svelte/elements";

  type DivAttributes = HTMLAttributes<HTMLDivElement>;
  let {
    file,
    uploaded = false,
    ...attrs
  }: {
    file?: string | null;
    uploaded?: boolean;
  } & DivAttributes = $props();

  let src = $state<string | null>(null);
  let abort: AbortController | null = null;

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
    <img {src} alt="Book cover" />
  {:else}
    <NoCoverIcon size={64} color="var(--color-muted)" />{/if}
</div>

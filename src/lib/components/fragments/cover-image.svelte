<script lang="ts">
  import { apiClient } from "$lib/api/client";
  import { type HTMLImgAttributes } from "svelte/elements";
  import type { a } from "vitest/dist/chunks/suite.d.FvehnV49.js";
  let {
    file,
    uploaded = false,
    ...attrs
  }: {
    file?: string | null;
    uploaded?: boolean;
  } & HTMLImgAttributes = $props();
  const src = $derived(
    apiClient.fullUrl(
      uploaded ? `/files/download/uploaded/${file}` : `/files/download/${file}`,
    ),
  );
</script>

<img {...attrs} {src} alt="Book cover" />

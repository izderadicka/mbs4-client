<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    type = "button",
    disabled = false,
    onclick,
    children,
  }: {
    type?: "button" | "submit";
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  } = $props();
</script>

<button {type} {disabled} {onclick}>
  {#if children}
    {@render children()}
  {/if}
</button>

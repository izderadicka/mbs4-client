<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: Snippet;
  };

  let { value = "", onValueChange, children }: Props = $props();
</script>

<input
  aria-label="Bookshelf"
  value={value}
  oninput={(e) => onValueChange?.((e.currentTarget as HTMLInputElement).value)}
/>
{#if children}
  {@render children()}
{/if}

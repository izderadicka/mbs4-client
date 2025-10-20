<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { SvelteHTMLElements } from "svelte/elements";
  type Level = 1 | 2 | 3;
  let {
    children,
    level = 1,
    ...restProps
  }: {
    children: () => any;
    level?: Level;
  } & SvelteHTMLElements["h2"] = $props();
  const { class: className, ...rest } = restProps;
  const ariaLevel = level + 1;
  const elementName = `h${ariaLevel}`;
  const fontSize = level === 1 ? "lg" : "base";
</script>

<svelte:element
  this={elementName}
  class={cn(className, `text-${fontSize} font-bold mb-0`)}
  {...rest}
  aria-level={ariaLevel}
  >{@render children()}
</svelte:element>

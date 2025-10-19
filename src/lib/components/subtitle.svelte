<script lang="ts">
  type Level = 1 | 2 | 3;
  let { children, level = 1 }: { children: () => any; level?: Level } =
    $props();
  const ariaLevel = level + 1;
  const elementName = `h${ariaLevel}`;
  const fontSize = level === 1 ? "lg" : "base";
  const marginBottom = level === 1 ? "2" : "1";
</script>

<svelte:element
  this={elementName}
  class="text-{fontSize} font-bold mb-{marginBottom}"
  aria-level={ariaLevel}
  >{@render children()}
</svelte:element>

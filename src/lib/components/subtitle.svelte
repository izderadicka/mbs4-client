<script lang="ts">
  type Level = 1 | 2 | 3;
  let { children, level = 1 }: { children: () => any; level?: Level } =
    $props();
  const ariaLevel = level + 1;
  const elementName = `h${ariaLevel}`;
  const fontSize = 4 - level;
</script>

<svelte:element
  this={elementName}
  class="text-{fontSize}xl font-bold mb-6"
  aria-level={ariaLevel}
  >{@render children()}
</svelte:element>

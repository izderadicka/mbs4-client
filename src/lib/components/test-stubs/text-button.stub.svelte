<script lang="ts">
  let {
    type = "button",
    disabled = false,
    onclick,
    children,
  }: {
    type?: "button" | "submit";
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: () => void;
  } = $props();
</script>

<button {type} {disabled} {onclick}>
  {@render children?.()}
</button>

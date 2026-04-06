<script lang="ts">
  let { open = $bindable(), children } = $props();
</script>

{@render children?.()}

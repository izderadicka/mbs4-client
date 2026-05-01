<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { hasRole } from "$lib/globals.svelte";

  const { children } = $props();

  onMount(() => {
    if (!hasRole("Admin")) goto("/");
  });
</script>

{#if hasRole("Admin")}
  {@render children()}
{/if}

<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { hasRole } from "$lib/globals.svelte";
  import { ADMIN_ROLE } from "$lib/api";

  const { children } = $props();

  onMount(() => {
    if (!hasRole(ADMIN_ROLE)) goto("/");
  });
</script>

{#if hasRole(ADMIN_ROLE)}
  {@render children()}
{/if}

<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { appUser } from "$lib/globals.svelte";

  onMount(() => {
    if (!appUser.user) {
      goto("/login");
    }
  });
  const { children } = $props();
</script>

{#if appUser.user}
  {@render children?.()}
{/if}

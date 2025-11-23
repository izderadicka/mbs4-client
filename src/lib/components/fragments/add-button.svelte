<script lang="ts">
  import { hasRole } from "$lib/globals.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import AddIcon from "@lucide/svelte/icons/plus";

  let { entity }: { entity: string } = $props();
</script>

{#if hasRole("Trusted")}
  <Button class="ml-auto" href="/{entity}/new"
    ><AddIcon /><span class="ml-2 hidden md:inline">Add</span></Button>
{/if}

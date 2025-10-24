<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import type { Snippet } from "svelte";
  const { entityName, children }: { entityName: string; children: Snippet } =
    $props();
  let dialogOpen = $state(false);

  export function open() {
    dialogOpen = true;
  }

  export function close() {
    dialogOpen = false;
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create new {entityName}</Dialog.Title>
      <Dialog.Description
        >Before creating a new {entityName} check that it doesn't already exist</Dialog.Description
      >
    </Dialog.Header>
    {@render children()}
  </Dialog.Content>
</Dialog.Root>

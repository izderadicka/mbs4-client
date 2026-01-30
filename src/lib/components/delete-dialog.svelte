<script lang="ts">
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Button } from "./ui/button";

  let open = $state(false);

  type Props = {
    onConfirmedDelete: (id: number) => void;
  };

  type EntityInfo = {
    id: number;
    name: string;
    detail?: string;
  };

  let { onConfirmedDelete } = $props();
  let entity: EntityInfo = $state({ id: 0, name: "" });

  export function openDialog(toDelete: EntityInfo) {
    entity = toDelete;
    open = true;
  }

  function onConfirm() {
    open = false;
    onConfirmedDelete(entity.id);
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete {entity.name}</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete this {entity.name}{#if entity.detail}: {entity.detail}{/if}
        ?
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action>
        {#snippet child()}
          <Button variant="destructive" onclick={onConfirm}>Delete</Button>
        {/snippet}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

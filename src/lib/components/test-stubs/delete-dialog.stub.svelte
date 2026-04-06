<script lang="ts">
  type Props = {
    onConfirmedDelete: (id: number) => void | Promise<void>;
  };

  type EntityInfo = {
    id: number;
    name: string;
    detail?: string;
  };

  let { onConfirmedDelete }: Props = $props();
  let entity = $state<EntityInfo | null>(null);

  export function openDialog(toDelete: EntityInfo) {
    entity = toDelete;
  }
</script>

{#if entity}
  <button type="button" onclick={() => onConfirmedDelete(entity!.id)}>
    Confirm Delete
  </button>
{/if}

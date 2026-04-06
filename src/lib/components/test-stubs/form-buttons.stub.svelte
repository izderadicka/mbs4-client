<script lang="ts">
  type Props = {
    id?: number | null;
    onCancel: () => void | Promise<void>;
    onDelete?: (id: number) => void;
  };

  let { id, onCancel, onDelete }: Props = $props();
</script>

<div>
  {#if id && onDelete}
    <button type="button" onclick={() => onDelete(id)}>Delete</button>
  {/if}
  <button type="button" onclick={onCancel}>Cancel</button>
  <button type="submit">{id ? "Update" : "Create"}</button>
</div>

<script lang="ts">
  import { on } from "svelte/events";
  import { Button } from "../ui/button";
  import { FormButton } from "../ui/form";
  type Props = {
    id?: number | null;
    onCancel: () => void | Promise<void>;
    onDelete?: (id: number) => void;
  };
  let { id, onCancel, onDelete }: Props = $props();
</script>

<div class="flex justify-end gap-20">
  {#if id}
    <Button variant="destructive" onclick={() => onDelete && onDelete(id)}
      >Delete</Button>
  {/if}
  <div class="flex gap-2">
    <Button variant="outline" onclick={onCancel}>Cancel</Button>
    <FormButton>{id ? "Update" : "Create"}</FormButton>
  </div>
</div>

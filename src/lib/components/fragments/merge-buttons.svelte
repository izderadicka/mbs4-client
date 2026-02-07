<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import type { MergeDirection } from "$lib/types/app";

  let {
    onCancel,
    onMerge,
    disabled,
    mergeDirection,
  }: {
    onCancel: () => Promise<void> | void;
    onMerge: () => Promise<void> | void;
    disabled: boolean;
    mergeDirection: MergeDirection;
  } = $props();
</script>

<div class="flex justify-end gap-20">
  <div class="flex gap-2">
    <Button variant="outline" onclick={onCancel}>Cancel</Button>
    <Button onclick={onMerge} {disabled}
      >Merge {#if mergeDirection === "from"}From{:else}To{/if}</Button>
  </div>
</div>

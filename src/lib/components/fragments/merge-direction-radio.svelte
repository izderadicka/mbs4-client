<script lang="ts">
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { MergeDirection } from "$lib/types/app";

  type Props = {
    mergeDirection: MergeDirection;
    entityName: string;
  };

  let { mergeDirection = $bindable("from"), entityName }: Props = $props();
</script>

<RadioGroup.Root bind:value={mergeDirection}>
  <div class="flex items-center space-x-2">
    <RadioGroup.Item value="from" id="option-merge-from" />
    <Label for="option-merge-from">Merge other {entityName} here</Label>
  </div>
  <div class="flex items-center space-x-2">
    <RadioGroup.Item value="to" id="option-merge-to" />
    <Label for="option-merge-to">Merge to other {entityName}</Label>
  </div>
</RadioGroup.Root>

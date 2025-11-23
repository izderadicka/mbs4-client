<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import SelectTrigger from "./select-trigger-modified.svelte";
  import SortIcon from "@lucide/svelte/icons/arrow-down-narrow-wide";

  let {
    sort = $bindable(),
    sorting,
    onSortChange,
  }: {
    sort: string;
    sorting: Record<string, string>[];
    onSortChange: (s: string) => void;
  } = $props();
</script>

<Select.Root
  type="single"
  name="sort"
  bind:value={sort}
  onValueChange={onSortChange}>
  <SelectTrigger class="w-[140px]">
    {#snippet children()}
      {sorting.find((o) => o.value === sort)?.label}
    {/snippet}
    {#snippet icon()}
      <SortIcon class="size-4 opacity-50" />
    {/snippet}
  </SelectTrigger>
  <Select.Content>
    {#each sorting as option}
      <Select.Item value={option.value}>{option.label}</Select.Item>
    {/each}
  </Select.Content>
</Select.Root>

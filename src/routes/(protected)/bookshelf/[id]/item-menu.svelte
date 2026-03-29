<script lang="ts" module>
  export type ItemMenuActions = "remove" | "edit";
</script>

<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { hasRole } from "$lib/globals.svelte";
  import type { BookshelfItem } from "$lib/api";
  import { on } from "svelte/events";
  type Props = {
    item: BookshelfItem;
    onItemMenuSelected: (item: BookshelfItem, action: ItemMenuActions) => void;
  };

  let { item, onItemMenuSelected }: Props = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost">
        <MenuIcon class="" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Group>
      <DropdownMenu.Label>Bookshelf Items Actions</DropdownMenu.Label>
      <DropdownMenu.Separator />

      <DropdownMenu.Item onSelect={() => onItemMenuSelected(item, "edit")}
        >Edit Item</DropdownMenu.Item>
      <DropdownMenu.Item onSelect={() => onItemMenuSelected(item, "remove")}
        >Remove from List</DropdownMenu.Item>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

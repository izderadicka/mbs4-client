<script lang="ts" module>
  export type SourceMenuActions = "delete" | "convert";
</script>

<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { EbookSource } from "$lib/api";
  type Props = {
    source: EbookSource;
    onMenuSelected: (source: EbookSource, action: SourceMenuActions) => void;
  };
  let { source, onMenuSelected }: Props = $props();
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
      <DropdownMenu.Label>Ebook File Actions</DropdownMenu.Label>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onSelect={() => onMenuSelected(source, "delete")}
        >Delete File</DropdownMenu.Item>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

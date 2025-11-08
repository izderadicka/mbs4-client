<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/menu";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";

  type Props<T> = {
    onMenuSelected: (action: T) => void;
    title: string;
    menu: { name: string; action: T }[];
  };
  let { onMenuSelected, title, menu }: Props<any> = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost">
        <MenuIcon class="size-7" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Group>
      <DropdownMenu.Label>{title}</DropdownMenu.Label>
      <DropdownMenu.Separator />
      {#each menu as { name, action }}
        <DropdownMenu.Item onSelect={() => onMenuSelected(action)}
          >{name}</DropdownMenu.Item>
      {/each}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

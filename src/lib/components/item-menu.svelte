<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/menu";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { hasAnyRole } from "$lib/globals.svelte";
  import { ADMIN_ROLE, type Role } from "$lib/api";

  type Props<T> = {
    onMenuSelected: (action: T) => void;
    title: string;
    menu: { name: string; action: T; requiredRole?: Role }[];
  };
  let { onMenuSelected, title, menu }: Props<any> = $props();

  let visibleMenu = $derived(
    menu.filter(
      (item) => !item.requiredRole || hasAnyRole(item.requiredRole, ADMIN_ROLE),
    ),
  );
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
      {#each visibleMenu as { name, action }}
        <DropdownMenu.Item onSelect={() => onMenuSelected(action)}
          >{name}</DropdownMenu.Item>
      {/each}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

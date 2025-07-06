<script lang="ts">
  import { appUser } from "$lib/globals.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";
  import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import UserIcon from "@lucide/svelte/icons/user";
  import { goto } from "$app/navigation";
  import { apiClient } from "$lib/api/client";

  const sidebar = useSidebar();

  function logout() {
    appUser.user = null;
    localStorage.removeItem("user");
    apiClient.logout();
    goto("/login");
  }
</script>

{#if appUser.user}
  <Sidebar.Menu>
    <Sidebar.MenuItem>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Sidebar.MenuButton
              size="lg"
              class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              {...props}
            >
              <UserIcon class="size-5" />
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate text-xs">{appUser.user?.email}</span>
              </div>
              <ChevronsUpDownIcon class="ml-auto size-4" />
            </Sidebar.MenuButton>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          class="w-(--bits-dropdown-menu-anchor-width) min-w-56 rounded-lg"
          side={sidebar.isMobile ? "bottom" : "right"}
          align="end"
          sideOffset={4}
        >
          <DropdownMenu.Label class="p-0 font-normal">
            <UserIcon class="size-5 float-left" />

            <div class="grid flex-1 text-left text-sm leading-tight px-2">
              <span class="truncate text-s">{appUser.user?.email}</span>
            </div>
          </DropdownMenu.Label>
          <DropdownMenu.Separator />

          <DropdownMenu.Group>
            <DropdownMenu.Item>
              <BadgeCheckIcon />
              Account Info
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={logout}>
            <LogOutIcon />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Sidebar.MenuItem>
  </Sidebar.Menu>
{/if}

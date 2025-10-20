<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import type { MenuItem } from "$lib/components/app-sidebar.svelte";
  import { appUser } from "$lib/globals.svelte";

  function hasRole(item: MenuItem) {
    if (item.requiredRole) {
      return appUser.user?.roles.includes(item.requiredRole);
    }
    return true;
  }

  let {
    items,
  }: {
    items: MenuItem[];
  } = $props();
</script>

<Sidebar.Group>
  <!-- <Sidebar.GroupLabel>Platform</Sidebar.GroupLabel> -->
  <Sidebar.Menu>
    {#each items as item (item.title)}
      {#if hasRole(item)}
        {#if item.items}
          <Collapsible.Root open={item.isOpen} class="group/collapsible">
            {#snippet child({ props })}
              <Sidebar.MenuItem {...props}>
                <Collapsible.Trigger>
                  {#snippet child({ props })}
                    <Sidebar.MenuButton {...props} tooltipContent={item.title}>
                      {#if item.icon}
                        <item.icon />
                      {/if}
                      <span>{item.title}</span>
                      <ChevronRightIcon
                        class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                      />
                    </Sidebar.MenuButton>
                  {/snippet}
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Sidebar.MenuSub>
                    {#each item.items ?? [] as subItem (subItem.title)}
                      {#if hasRole(subItem)}
                        <Sidebar.MenuSubItem>
                          <Sidebar.MenuSubButton>
                            {#snippet child({ props })}
                              <a href={subItem.url} {...props}>
                                <span>{subItem.title}</span>
                              </a>
                            {/snippet}
                          </Sidebar.MenuSubButton>
                        </Sidebar.MenuSubItem>
                      {/if}
                    {/each}
                  </Sidebar.MenuSub>
                </Collapsible.Content>
              </Sidebar.MenuItem>
            {/snippet}
          </Collapsible.Root>
        {:else}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>
              {#snippet child({ props })}
                <a href={item.url} {...props}>
                  {#if item.icon}
                    <item.icon />
                  {/if}
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/if}
      {/if}
    {/each}
  </Sidebar.Menu>
</Sidebar.Group>

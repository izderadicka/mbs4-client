<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { appUser } from "$lib/globals.svelte";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import BreadcrumbNav from "$lib/components/breadcrumb-nav.svelte";
  import EventsInbox from "$lib/components/events-inbox.svelte";

  onMount(() => {
    if (!appUser.user) {
      goto("/login");
    }
  });
  const { children } = $props();
</script>

{#if appUser.user}
  <Sidebar.Provider>
    <AppSidebar />
    <Sidebar.Inset>
      <header
        class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear"
      >
        <div class="flex flex-1 items-center gap-2 px-4">
          <Sidebar.Trigger class="-ml-1" />
          <Separator
            orientation="vertical"
            class="mr-2 data-[orientation=vertical]:h-4"
          />
          <BreadcrumbNav />
          <div class="ml-auto">
            <EventsInbox maxItems={20} />
          </div>
        </div>
      </header>

      <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
        {@render children()}
      </div>
    </Sidebar.Inset>
  </Sidebar.Provider>
{/if}

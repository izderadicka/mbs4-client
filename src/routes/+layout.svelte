<script lang="ts">
  import "../app.css";

  import { ModeWatcher } from "mode-watcher";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import BreadcrumbNav from "$lib/components/breadcrumb-nav.svelte";
  import type { User } from "$lib/types/app";
  import { appUser } from "$lib/globals.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import EventsInbox from "$lib/components/events-inbox.svelte";
  const { children, data } = $props();
  const { user }: { user: User | null } = data;
  if (user) {
    appUser.user = user;
  } else {
    appUser.user = null;
    localStorage.removeItem("user");
  }

  onMount(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("trt")) {
      url.searchParams.delete("trt");
      goto(url.pathname + url.search, { replaceState: true, noScroll: true });
    }
  });
</script>

<ModeWatcher />

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

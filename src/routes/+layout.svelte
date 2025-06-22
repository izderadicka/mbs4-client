<script lang="ts">
  import "../app.css";

  import { ModeWatcher } from "mode-watcher";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import BreadcrumbNav from "$lib/components/breadcrumb-nav.svelte";
  import type { User } from "$lib/types/app";
  import { appUser } from "$lib/globals.svelte";
  const { children, data } = $props();
  const { user }: { user: User | null } = data;
  if (user) {
    if (user.tokenValidity + 15 * 60 * 1000 < Date.now()) {
    }
    appUser.user = user;
  } else {
    appUser.user = null;
    localStorage.removeItem("user");
  }
</script>

<ModeWatcher />

<Sidebar.Provider>
  <AppSidebar />
  <Sidebar.Inset>
    <header
      class="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear"
    >
      <div class="flex items-center gap-2 px-4">
        <Sidebar.Trigger class="-ml-1" />
        <Separator
          orientation="vertical"
          class="mr-2 data-[orientation=vertical]:h-4"
        />
        <BreadcrumbNav />
      </div>
    </header>

    <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
      {@render children()}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>

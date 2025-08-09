<script lang="ts" module>
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import LibraryIcon from "@lucide/svelte/icons/library-big";
  import LoginIcon from "@lucide/svelte/icons/log-in";

  // This is sample data.
  const data = {
    user: {
      name: "shadcn",
      email: "m@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
    navPublic: [{ title: "Login", url: "/login", icon: LoginIcon }],
    navMain: [
      {
        title: "Library",
        url: "#",
        icon: LibraryIcon,
        isActive: true,
        items: [
          {
            title: "Upload new Ebook",
            url: "/upload",
          },
          {
            title: "Ebooks",
            url: "/ebook",
          },
          {
            title: "Authors",
            url: "#",
          },
          {
            title: "Series",
            url: "#",
          },
        ],
      },

      {
        title: "Settings",
        url: "#",
        icon: Settings2Icon,
        items: [
          {
            title: "General",
            url: "#",
          },
          {
            title: "Team",
            url: "#",
          },
          {
            title: "Billing",
            url: "#",
          },
          {
            title: "Limits",
            url: "#",
          },
        ],
      },
    ],
  };
</script>

<script lang="ts">
  import { appUser } from "$lib/globals.svelte";
  import NavMain from "./nav-main.svelte";
  import NavUser from "./nav-user.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";

  import { toggleMode as toggleDarkMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";

  const sidebar = useSidebar();

  let {
    ref = $bindable(null),
    collapsible = "icon",
    ...restProps
  }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root {collapsible} {...restProps}>
  <Sidebar.Header
    ><h1
      class="{sidebar.state === 'expanded' ? 'text-2xl' : 'text-sm'} font-bold"
    >
      mbs4
    </h1></Sidebar.Header
  >
  <Sidebar.Content>
    <NavMain items={appUser.user ? data.navMain : data.navPublic} />
  </Sidebar.Content>
  <Sidebar.Footer>
    <Button onclick={toggleDarkMode} variant="outline" size="icon">
      <SunIcon
        class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
      />
      <MoonIcon
        class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
      />
      <span class="sr-only">Toggle theme</span>
    </Button>

    <NavUser />
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>

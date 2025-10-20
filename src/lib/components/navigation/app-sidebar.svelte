<script lang="ts" module>
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import LibraryIcon from "@lucide/svelte/icons/library-big";
  import CogIcon from "@lucide/svelte/icons/settings";

  interface InnerMenuItem {
    title: string;
    url: string;
    icon?: any;
    requiredRole?: string;
  }

  export interface MenuItem {
    title: string;
    url?: string;
    icon?: any;
    isOpen?: boolean;
    items?: InnerMenuItem[];
    requiredRole?: string;
  }

  // This is sample data.
  const mainMenu: MenuItem[] = [
    {
      title: "Library",
      icon: LibraryIcon,
      isOpen: true,
      items: [
        {
          title: "Upload new Ebook",
          url: "/upload",
          requiredRole: "Trusted",
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
      ],
    },

    {
      title: "Admin",
      url: "#",
      icon: CogIcon,
      items: [
        {
          title: "General",
          url: "#",
        },
      ],
    },
  ];
</script>

<script lang="ts">
  import { appUser } from "$lib/globals.svelte";
  import NavMain from "$lib/components/navigation/nav-main.svelte";
  import NavUser from "$lib/components/navigation/nav-user.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";

  import { toggleMode as toggleDarkMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button/index.js";
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";
  import type { User } from "$lib/types/app";
  import { afterNavigate } from "$app/navigation";

  afterNavigate(() => {
    sidebar.setOpenMobile(false);
    console.log(
      `afterNavigate, sidebar state is ${sidebar.state}, open is ${sidebar.open}, isMobile is ${sidebar.isMobile} openMobile is ${sidebar.openMobile}`
    );
  });

  const sidebar = useSidebar();

  function filterMenuForUser(menu: Record<string, any>[], user: User | null) {
    if (user) {
      return menu;
    }
  }

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
    <NavMain items={mainMenu} />
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

<script lang="ts">
  // Minimal host for the swipe gesture: the provider supplies the sidebar
  // context and the root renders the off-canvas sheet on small screens.
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import SidebarSwipe from "$lib/components/navigation/sidebar-swipe.svelte";
</script>

<Sidebar.Provider>
  <SidebarSwipe />
  <Sidebar.Root>
    <Sidebar.Content>Main menu</Sidebar.Content>
  </Sidebar.Root>
  <main>page content</main>
</Sidebar.Provider>

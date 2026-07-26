<script lang="ts">
  // Mobile edge swipe for the navigation sidebar: dragging in from the left
  // border of the screen opens it, dragging back to the left closes it - on
  // small screens the sidebar is off-canvas and was otherwise reachable only
  // through the trigger button in the header.
  //
  // Renders nothing; must be placed inside `Sidebar.Provider`.
  import { useSidebar } from "$lib/components/ui/sidebar/index.js";
  import { HorizontalSwipeRecognizer, type SwipePoint } from "$lib/gestures";

  // how far from the viewport's left border an opening swipe has to start
  const EDGE_ZONE_PX = 32;
  // a dialog of ours is open and modal - the sidebar must stay out of the way
  const OPEN_MODAL_SELECTOR =
    '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]';

  const sidebar = useSidebar();

  const recognizer = new HorizontalSwipeRecognizer({
    // on wider screens the sidebar is docked and toggled by its trigger and rail
    enabled: () => sidebar.isMobile,
    claim: (start: SwipePoint) =>
      // while the sidebar is open, a drag anywhere may close it; while it is
      // closed, only one starting at the border may open it
      sidebar.openMobile ||
      (start.x <= EDGE_ZONE_PX && !document.querySelector(OPEN_MODAL_SELECTOR)),
    onSwipe: ({ direction }) => {
      if (direction === "right" && !sidebar.openMobile) {
        sidebar.setOpenMobile(true);
      } else if (direction === "left" && sidebar.openMobile) {
        sidebar.setOpenMobile(false);
      }
    },
  });

  $effect(() => recognizer.observe(window));
</script>

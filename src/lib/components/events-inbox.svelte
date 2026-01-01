<!-- SseInbox.svelte -->
<script lang="ts">
  // UI (shadcn-svelte)
  import { Button } from "$lib/components/ui/button";
  import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
  } from "$lib/components/ui/sheet";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Separator } from "$lib/components/ui/separator";
  import { Badge } from "$lib/components/ui/badge";
  import BellRing from "@lucide/svelte/icons/bell-ring";
  import { onMount, untrack } from "svelte";
  import { appUser, events } from "$lib/globals.svelte";
  import type { EventItem } from "$lib/types/app";
  import { apiClient } from "$lib/api/client";
  import { AUTOLOGIN } from "$lib/dev";
  import EventBlock from "./fragments/event-item.svelte";

  const { maxItems = 20 }: { maxItems?: number } = $props();

  let open = $state(false);
  let connected = $state(false);

  const unread = $derived(events.items.filter((e) => !e.read).length);

  let lastEventId: string | null = null;

  //   // ---- Load persisted state (client only)
  //   if (typeof window !== "undefined") {
  //     const saved = localStorage.getItem("sse:events");
  //     if (saved) {
  //       try {
  //         events = JSON.parse(saved) as EventItem[];
  //       } catch {}
  //     }
  //     lastEventId = localStorage.getItem("sse:lastEventId");
  //   }

  //   // ---- Persist changes
  //   $effect(() => {
  //     if (typeof window === "undefined") return;
  //     localStorage.setItem("sse:events", JSON.stringify(events.slice(-maxItems)));
  //     if (lastEventId) localStorage.setItem("sse:lastEventId", lastEventId);
  //   });

  let es: EventSource | null = null;

  // if appUser changes restart events
  $effect(() => {
    if (appUser.user && !AUTOLOGIN) {
      stopEvents();
      startEvents();
    }
  });

  function startEvents() {
    console.log("Staring events");
    es = apiClient.createEventSource(lastEventId);

    es.onopen = () => (connected = true);
    es.onerror = (e) => {
      connected = false;
      console.error(e);
    };

    es.onmessage = (e: MessageEvent) => {
      console.log(e);
      push({ id: e.lastEventId || null, data: JSON.parse(e.data) });
    };
  }

  function stopEvents() {
    if (es) {
      es.close();
      es = null;
    }
  }

  onMount(() => {
    return () => {
      stopEvents();
    };
  });

  function push(evt: Omit<EventItem, "receivedAt" | "read">) {
    const item: EventItem = {
      ...evt,
      receivedAt: new Date().toISOString(),
      read: open ? true : false,
    };
    events.items = [...events.items.slice(-(maxItems - 1)), item];
  }

  function markAllRead() {
    events.items = events.items.map((e) => ({ ...e, read: true }));
  }

  //   Mark everything read whenever the sheet opens.
  $effect(() => {
    if (open) untrack(markAllRead);
  });

  function clearAll() {
    events.items = [];
    // if (typeof window !== "undefined") localStorage.removeItem("sse:events");
  }
</script>

<!-- Trigger: bell with unread badge -->
<Sheet bind:open>
  <SheetTrigger>
    <Button variant="ghost" class="relative" aria-label="Notifications">
      <BellRing class="size-6" />
      {#if unread > 0}
        <Badge variant="secondary">
          {unread}
        </Badge>
      {/if}
    </Button>
  </SheetTrigger>

  <!-- Sidebar -->
  <SheetContent side="right" class="flex flex-col w-[18rem] sm:w-[32rem]">
    <SheetHeader class="space-y-1 pb-0">
      <SheetTitle>Notifications</SheetTitle>
      <SheetDescription class="flex items-center gap-2">
        <span class="flex-1 text-xs">
          {connected ? "Live" : "Reconnecting…"} · {events.items.length} items
        </span>

        <Button
          variant="secondary"
          size="sm"
          class="h-auto px-2 text-xs opacity-70 hover:opacity-100 cursor-pointer"
          onclick={clearAll}>
          Clear
        </Button>
      </SheetDescription>
    </SheetHeader>

    <Separator class="my-1" />

    <ScrollArea class="flex-1 overflow-y-auto pr-2 pl-2">
      <ul class="space-y-2">
        {#each [...events.items].reverse() as event (event.receivedAt)}
          <EventBlock {event} />
        {/each}

        {#if events.items.length === 0}
          <li class="text-sm opacity-70">No events yet.</li>
        {/if}
      </ul>
    </ScrollArea>
  </SheetContent>
</Sheet>

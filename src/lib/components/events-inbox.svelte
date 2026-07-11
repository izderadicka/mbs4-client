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

  const LAST_EVENT_ID_KEY = "sse:lastEventId";
  const RECONNECT_DELAY = 5_000;

  let lastEventId: string | null =
    typeof window !== "undefined"
      ? sessionStorage.getItem(LAST_EVENT_ID_KEY)
      : null;
  // Ids already received this session - drops duplicates from server replay
  const seenIds = new Set<string>();

  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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

    es.onopen = () => {
      connected = true;
      clearReconnectTimer();
    };
    es.onerror = (e) => {
      connected = false;
      console.error(e);
      // Browser retries CONNECTING streams itself, but never a CLOSED one
      if (es?.readyState === EventSource.CLOSED && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          stopEvents();
          startEvents();
        }, RECONNECT_DELAY);
      }
    };

    es.onmessage = (e: MessageEvent) => {
      console.log(e);
      const id = e.lastEventId || null;
      if (id) {
        lastEventId = id;
        sessionStorage.setItem(LAST_EVENT_ID_KEY, id);
        if (seenIds.has(id)) return;
        seenIds.add(id);
      }
      push({ id, data: JSON.parse(e.data) });
    };
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function stopEvents() {
    clearReconnectTimer();
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

  // Batch events are flat and always carry batch_id (and operation_id). All
  // events of one batch share this key, so a new progress/complete event
  // supersedes the previous one.
  function batchKey(e: EventItem): string | null {
    const d = (e.data as any)?.data;
    if (d?.batch_id == null) return null;
    return `${d.operation_id}:${d.batch_id}`;
  }

  function push(evt: Omit<EventItem, "receivedAt" | "read">) {
    const item: EventItem = {
      ...evt,
      receivedAt: new Date().toISOString(),
      read: open ? true : false,
    };
    const key = batchKey(item);
    if (key !== null) {
      // Keep only the latest event for this batch, then append so it shows on top after reversal
      const filtered = events.items.filter((e) => batchKey(e) !== key);
      events.items = [...filtered.slice(-(maxItems - 1)), item];
    } else {
      events.items = [...events.items.slice(-(maxItems - 1)), item];
    }
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
        {#each [...events.items].reverse() as event (event.id ?? event.receivedAt)}
          <EventBlock {event} />
        {/each}

        {#if events.items.length === 0}
          <li class="text-sm opacity-70">No events yet.</li>
        {/if}
      </ul>
    </ScrollArea>
  </SheetContent>
</Sheet>

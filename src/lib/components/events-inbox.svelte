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
  // Icon (lucide-svelte)
  import BellRing from "@lucide/svelte/icons/bell-ring";
  import { onMount, untrack } from "svelte";
  import { appUser, events } from "$lib/globals";
  import type { EventItem } from "$lib/types/app";
  import { apiClient } from "$lib/api/client";
  import { AUTOLOGIN } from "$lib/dev";

  const { maxItems = 20 }: { maxItems?: number } = $props();
  /** SSE endpoint (Axum route), e.g. "/sse" */

  const withCredentials: boolean = false;
  /** Keep at most N events in memory/localStorage */

  let open = $state(false);
  let connected = $state(false);
  //   let paused = $state(false);

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

  // ---- SSE connection
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
  <SheetContent side="right" class="w-[1    8rem] sm:w-[32rem]">
    <SheetHeader>
      <SheetTitle>Notifications</SheetTitle>
      <SheetDescription>
        {connected ? "Live" : "Reconnecting…"} · {events.items.length} items
      </SheetDescription>
    </SheetHeader>

    <div class="my-3 flex items-center gap-2">
      <Button variant="secondary" onclick={clearAll}>Clear</Button>
    </div>

    <Separator class="my-2" />

    <ScrollArea class="h-[70vh] pr-4">
      <ul class="space-y-2">
        {#each [...events.items].reverse() as e (e.receivedAt)}
          <li class="p-2 rounded border">
            <div class="flex items-center justify-between">
              <div class="text-xs opacity-70">
                {new Date(e.receivedAt).toLocaleString()}
              </div>
              <div class="flex items-center gap-2">
                {#if !e.read}<Badge>new</Badge>{/if}
              </div>
            </div>

            <pre class="mt-1 text-xs whitespace-pre-wrap break-words">
{typeof e.data === "string" ? e.data : JSON.stringify(e.data, null, 2)}
            </pre>
          </li>
        {/each}

        {#if events.items.length === 0}
          <li class="text-sm opacity-70">No events yet.</li>
        {/if}
      </ul>
    </ScrollArea>
  </SheetContent>
</Sheet>

<style>
  /* keep styling minimal; rely on shadcn/tailwind defaults */
</style>

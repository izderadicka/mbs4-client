<script lang="ts">
  type EventType = "error" | "metadata" | "conversion" | "batch_progress" | "batch_complete" | "unknown";
  import type { EventItem } from "$lib/types/app";
  import type { BatchCompleteEvent, BatchProgressEvent } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { Badge } from "$lib/components/ui/badge";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import * as Collapsible from "$lib/components/ui/collapsible/index.js";
  import { buttonVariants } from "$lib/components/ui/button/index.js";

  let { event }: { event: EventItem } = $props();

  function qualifyEvent(event: EventItem): EventType {
    const data = (event.data as any)?.data;
    // Batch payloads are flat and always carry batch_id; check first because a
    // failed batch_progress item also sets `error`.
    if (data?.batch_id != null) {
      return "ok" in data ? "batch_complete" : "batch_progress";
    }
    if (data?.error) return "error";
    if (data?.metadata) return "metadata";
    if (data?.conversion) return "conversion";
    return "unknown";
  }

  let eventType = $derived(qualifyEvent(event));
  let batchProgress = $derived(
    eventType === "batch_progress"
      ? ((event.data as any).data as BatchProgressEvent)
      : null,
  );
  let batchComplete = $derived(
    eventType === "batch_complete"
      ? ((event.data as any).data as BatchCompleteEvent)
      : null,
  );
</script>

<li class="p-2 rounded border">
  <div class="flex items-center justify-between">
    <div class="text-xs opacity-70">
      {new Date(event.receivedAt).toLocaleString()}
    </div>
    <div class="flex items-center gap-2">
      {#if !event.read}<Badge>new</Badge>{/if}
    </div>
  </div>

  <Collapsible.Root class="">
    <div class="flex justify-between space-x-4">
      <h4 class="text-sm font-semibold text-content">
        {#if eventType === "metadata"}Metadata extracted{/if}
        {#if eventType === "error"}<span class="text-red-500">Operation Error</span>{/if}
        {#if eventType === "conversion"}Conversion to {event.data.data
            .conversion?.format_extension} successful in
          <a href="/ebook/{event.data.data.conversion?.ebook_id}">this ebook</a>
        {/if}
        {#if eventType === "batch_progress" && batchProgress}
          Converting “{batchProgress.batch_name}”: {batchProgress.done}/{batchProgress.total}
          (<a href="/conversion-batch/{batchProgress.batch_id}">view</a>)
        {/if}
        {#if eventType === "batch_complete" && batchComplete}
          {#if batchComplete.zip_location}
            “{batchComplete.batch_name}” complete: {batchComplete.ok + batchComplete.reused}/{batchComplete.total} succeeded
            (<a href="/conversion-batch/{batchComplete.batch_id}">details</a>
            · <a href={apiClient.conversionUrl(batchComplete.zip_location)}>Download ZIP</a>)
          {:else}
            “{batchComplete.batch_name}” finished: {batchComplete.ok + batchComplete.reused}/{batchComplete.total} succeeded
            {#if batchComplete.failed > 0}<span class="text-red-500">({batchComplete.failed} failed)</span>{/if}
            (<a href="/conversion-batch/{batchComplete.batch_id}">details</a>)
          {/if}
        {/if}
        {#if eventType === "unknown"}Unknown event{/if}
      </h4>
      <Collapsible.Trigger
        class={buttonVariants({
          variant: "ghost",
          size: "sm",
          class: "w-4 h-4 p-0",
        })}>
        <ChevronsUpDownIcon />
        <span class="sr-only">Toggle</span>
      </Collapsible.Trigger>
    </div>
    <Collapsible.Content class="space-y-2">
      <pre class="mt-1 text-xs whitespace-pre-wrap break-words">
      {typeof event.data === "string"
          ? event.data
          : JSON.stringify(event.data, null, 2)}
      </pre>
    </Collapsible.Content>
  </Collapsible.Root>
</li>

<script lang="ts">
  import { onDestroy } from "svelte";
  import { toast } from "svelte-sonner";

  const DEBOUNCE_MS = 600;
  const MIN_FILTER_LENGTH = 3; // we have trigram indexes so 3 is minimum for search to work
  let debounceId: number | null = null;
  let inFlightController: AbortController | null = null;
  let requestSequence = 0;

  type Props<T> = {
    filter: string;
    search: (
      q: string,
      numResults: number,
      signal: AbortSignal
    ) => Promise<T[] | null>;
    onResult: (result: T[] | null) => void;
  };

  let { filter, search, onResult }: Props<any> = $props();

  onDestroy(() => {
    inFlightController?.abort();
    inFlightController = null;
    if (debounceId) clearTimeout(debounceId);
    debounceId = null;
  });

  $effect(() => {
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }

    if (filter.length < MIN_FILTER_LENGTH) {
      return;
    }

    debounceId = window.setTimeout(() => runSearch(filter), DEBOUNCE_MS);
  });

  async function runSearch(query: string) {
    try {
      const seq = ++requestSequence;
      inFlightController?.abort();
      const controller = new AbortController();
      inFlightController = controller;
      const res = await search(query, 10, controller.signal);
      if (seq !== requestSequence) return; // stale response
      onResult(res);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.log("Search aborted");
        return;
      }
      console.error("Search error", error);
      toast.error("Failed to search");
    }
  }
</script>

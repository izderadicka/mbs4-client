<script lang="ts">
  import { type Snippet } from "svelte";
  import * as Popover from "$lib/components/ui/popover";
  import { Input } from "$lib/components/ui/input";
  import { ScrollArea, Scrollbar } from "$lib/components/ui/scroll-area";
  import Loader2 from "@lucide/svelte/icons/loader-circle";
  import { on } from "svelte/events";
  import type { SearchEbookItem, SearchEbookMeta } from "$lib/api";

  type Loader = (q: string) => Promise<SearchEbookItem[]>;
  type SelectHandler = (i: number) => void;
  type SearchHandler = (q: string) => void;

  // ---- Props (Svelte 5 runes) ----
  const {
    load, // required (q) => Promise<BookItem[]>
    maxResults = 1000, // as safety limit
    placeholder = "Search books…",
    debounceMs = 400,
    minChars = 2,
    emptyText = "No matches",
    autoSelectFirst = false,
    onSelect = null,
    onSearch = null,
    renderItem,
  }: {
    load: Loader;
    maxResults?: number;
    placeholder?: string;
    debounceMs?: number;
    minChars?: number;
    emptyText?: string;
    autoSelectFirst?: boolean;
    renderItem?: Snippet<[{ book: SearchEbookItem }]>;
    onSelect?: SelectHandler | null;
    onSearch?: SearchHandler | null;
  } = $props();

  // ---- State ----
  let open = $state(false);
  let query = $state("");
  let results = $state<SearchEbookItem[]>([]);
  let loading = $state(false);
  let highlight = $state(-1);

  // ---- Debounce ----
  let debounceId: number | null = null;
  function onInput(q: string) {
    query = q;
    if (debounceId) clearTimeout(debounceId);
    debounceId = window.setTimeout(() => runSearch(query), debounceMs);
  }

  async function runSearch(q: string) {
    if (q.trim().length < minChars) {
      results = [];
      open = false;
      highlight = -1;
      return;
    }
    loading = true;
    try {
      const data = await load(q);
      results = (data ?? []).slice(0, maxResults);
      open = results.length > 0;
      highlight = autoSelectFirst && results.length ? 0 : -1;
    } finally {
      loading = false;
    }
  }

  // ---- Select / Submit ----
  function selectAt(i: number) {
    const book = results[i];
    if (!book || !onSelect) return;
    open = false;
    highlight = -1;
    onSelect(book.doc.id);
  }
  function submitSearch() {
    if (!query || !onSearch) return;
    open = false;
    highlight = -1;
    onSearch(query);
  }

  // ---- Keyboard on Input ----
  function onKeydown(e: KeyboardEvent) {
    e.stopPropagation();
    switch (e.key) {
      case "ArrowDown":
        if (!results.length) return;
        e.preventDefault();
        open = true;
        highlight = (highlight + 1) % results.length;
        break;
      case "ArrowUp":
        if (!results.length) return;
        e.preventDefault();
        open = true;
        highlight = (highlight - 1 + results.length) % results.length;
        break;
      case "Enter":
        if (open && highlight >= 0 && results[highlight]) {
          e.preventDefault();
          selectAt(highlight);
        } else {
          submitSearch();
        }
        open = false;
        break;
      case "Escape":
        open = false;
        highlight = -1;
        break;
    }
  }

  // ---- Keep highlighted row visible (Svelte 5 rune) ----
  // svelte-ignore non_reactive_update
  let listRoot: HTMLElement | null = null;
  $effect(() => {
    if (!open || highlight < 0 || highlight >= results.length) return;

    // Wait for DOM update so the highlighted row exists
    requestAnimationFrame(() => {
      const root = listRoot;
      if (!root) return;

      // Find the currently highlighted row within THIS popover
      const active = root.querySelector<HTMLElement>('[data-ba-active="true"]');
      if (!active) return;

      // This scrolls the nearest scrollable ancestor (ScrollArea viewport)
      active.scrollIntoView({ block: "nearest" });
    });
  });

  function fmtAuthors(authors: { name: string; id: number }[]) {
    return authors
      .slice(0, 2)
      .map((a) => a.name)
      .join(", ");
  }
  function fmtSeries(ebook: SearchEbookMeta) {
    if (!ebook.series) return "";
    return ebook.series_id != null
      ? `${ebook.series} #${ebook.series_id}`
      : ebook.series;
  }
</script>

<!-- Always-visible input; Popover opens only when results exist -->
<Popover.Root bind:open>
  <Popover.Trigger>
    <div class="w-full">
      <div class="relative">
        <Input
          {placeholder}
          value={query}
          autocomplete="off"
          oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
          onkeydown={onKeydown}
        />
        {#if loading}
          <Loader2
            class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin opacity-70"
          />
        {/if}
      </div>
    </div>
  </Popover.Trigger>

  <Popover.Content
    align="start"
    class="w-[--radix-popover-trigger-width] p-0"
    onOpenAutoFocus={(e) => e.preventDefault()}
    onCloseAutoFocus={(e) => e.preventDefault()}
  >
    {#if results.length > 0}
      <ScrollArea class="h-72">
        <ul role="listbox" data-ba-list bind:this={listRoot}>
          {#each results as book, i}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                data-ba-active={i === highlight}
                class="w-full text-left px-3 py-2 hover:bg-accent/60 hover:text-accent-foreground data-[ba-active=true]:bg-accent data-[ba-active=true]:text-accent-foreground"
                onmouseenter={() => {
                  //highlight = i)
                }}
                onmousedown={(e) => {
                  e.preventDefault();
                  selectAt(i);
                }}
              >
                {#if renderItem}
                  {@render renderItem({ book })}
                {:else}
                  <div class="flex flex-col">
                    <span class="truncate font-medium">{book.doc.title}</span>
                    <span class="truncate text-xs text-muted-foreground">
                      {fmtAuthors(book.doc.authors)}
                      {#if book.doc.series}
                        · {fmtSeries(book.doc)}
                      {/if}
                    </span>
                  </div>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
        <Scrollbar
          orientation="vertical"
          forceMount
          class="!opacity-100 transition-none"
        />
      </ScrollArea>
    {:else if !loading && query.trim().length >= minChars}
      <div class="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
    {/if}
  </Popover.Content>
</Popover.Root>

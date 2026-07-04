<script lang="ts">
  import { onMount } from "svelte";
  import { mode, toggleMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button";
  import * as Sheet from "$lib/components/ui/sheet";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import AArrowUpIcon from "@lucide/svelte/icons/a-arrow-up";
  import AArrowDownIcon from "@lucide/svelte/icons/a-arrow-down";
  import type {
    FoliateView,
    RelocateDetail,
    TOCItem,
  } from "foliate-js/view.js";

  let {
    file,
    storageKey,
    title,
    author,
    showBars = false,
  }: {
    file: File;
    storageKey: string;
    // metadata from the application; when missing, metadata embedded in the
    // book file is used as backup
    title?: string;
    author?: string;
    // initial visibility of header/footer; toggled by clicking the book page
    showBars?: boolean;
  } = $props();

  let container: HTMLDivElement;
  let view: FoliateView | null = null;
  let loading = $state(true);
  let error: string | null = $state(null);
  let bookTitle = $state("");
  let bookAuthor = $state("");
  let fraction = $state(0);
  let locationLabel = $state("");
  let toc: TOCItem[] = $state([]);
  let tocOpen = $state(false);
  let currentTocHref: string | null = $state(null);
  // svelte-ignore state_referenced_locally
  let chromeVisible = $state(showBars);

  // single text column may grow up to this width; wider views split into
  // two columns (foliate's default 720px switches to 2 columns too early)
  const MAX_COLUMN_WIDTH = "1024px";

  // paginator defaults reserve 48px top/bottom (for running heads we don't
  // show) and 7% horizontal gap - use tighter margins around the book page
  const PAGE_MARGIN = "16px";
  const PAGE_GAP = "4%";

  // book text size in percent, user preference shared by all books
  const FONT_SIZE_KEY = "mbs4.reader.fontSize";
  const FONT_SIZE_STEP = 10;
  const FONT_SIZE_MIN = 60;
  const FONT_SIZE_MAX = 200;

  function loadFontSize(): number {
    const stored = parseInt(localStorage.getItem(FONT_SIZE_KEY) ?? "");
    return stored >= FONT_SIZE_MIN && stored <= FONT_SIZE_MAX ? stored : 100;
  }

  let fontSize = $state(loadFontSize());

  function changeFontSize(delta: number) {
    fontSize = Math.min(
      FONT_SIZE_MAX,
      Math.max(FONT_SIZE_MIN, fontSize + delta),
    );
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
    } catch {
      // best effort only
    }
  }

  const percentFormat = new Intl.NumberFormat("en", { style: "percent" });
  let percent = $derived(percentFormat.format(fraction));

  // Language-map metadata values can be strings or {lang: value} objects
  function formatMetadataText(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value.map(formatMetadataText).filter(Boolean).join(", ");
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("name" in record) return formatMetadataText(record.name);
      const first = Object.values(record)[0];
      return typeof first === "string" ? first : "";
    }
    return "";
  }

  // Styles injected into the book's iframe; color-scheme follows the app
  // theme instead of the OS preference
  function contentCSS(scheme: "light" | "dark", sizePct: number): string {
    return `
      @namespace epub "http://www.idpf.org/2007/ops";
      html {
        color-scheme: ${scheme};
        font-size: ${sizePct}%;
      }
      ${scheme === "dark" ? "a:link { color: lightblue; }" : ""}
      p, li, blockquote, dd {
        line-height: 1.4;
        text-align: justify;
        -webkit-hyphens: auto;
        hyphens: auto;
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
      }
      [align="left"] { text-align: left; }
      [align="right"] { text-align: right; }
      [align="center"] { text-align: center; }
      [align="justify"] { text-align: justify; }
      pre { white-space: pre-wrap !important; }
      aside[epub|type~="endnote"],
      aside[epub|type~="footnote"],
      aside[epub|type~="note"],
      aside[epub|type~="rearnote"] {
        display: none;
      }
    `;
  }

  function onRelocate(event: Event) {
    const detail = (event as CustomEvent<RelocateDetail>).detail;
    // paging beyond the last page emits a bogus relocate with NaN fraction
    // (paginator computes (page-1)/(pages-2)) - ignore it entirely
    if (!Number.isFinite(detail.fraction)) return;
    fraction = Math.min(1, Math.max(0, detail.fraction));
    locationLabel = detail.pageItem
      ? `Page ${detail.pageItem.label}`
      : detail.location
        ? `Loc ${detail.location.current}`
        : "";
    currentTocHref = detail.tocItem?.href ?? null;
    if (detail.cfi) {
      try {
        localStorage.setItem(storageKey, detail.cfi);
      } catch {
        // best effort only - reading position is not critical
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!view) return;
    const k = event.key;
    if (k === "ArrowLeft" || k === "h") {
      // preventDefault stops native stepping of the focused progress slider
      // (default step of 1 would slam it to min/max on the 0-1 range)
      event.preventDefault();
      view.goLeft();
    } else if (k === "ArrowRight" || k === "l") {
      event.preventDefault();
      view.goRight();
    } else if (k === " ") {
      // reading-order forward regardless of book direction
      event.preventDefault();
      view.next();
    } else if (k === "m" || k === "M") {
      // toggle header/footer, same as clicking the book page
      event.preventDefault();
      chromeVisible = !chromeVisible;
    }
  }

  // click on the book page toggles header/footer, except clicks that
  // follow a link or finish a text selection
  function onContentClick(event: Event) {
    const target = event.target as Element | null;
    if (target?.closest("a[href]")) return;
    const selection = (target?.ownerDocument ?? document).getSelection();
    if (selection && !selection.isCollapsed) return;
    chromeVisible = !chromeVisible;
  }

  // forward key presses and clicks from inside the book's iframe
  function onDocumentLoad(event: Event) {
    const { doc } = (event as CustomEvent<{ doc: Document }>).detail;
    doc.addEventListener("keydown", handleKeydown);
    doc.addEventListener("click", onContentClick);
  }

  function onSliderInput(event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!Number.isNaN(value)) view?.goToFraction(value);
  }

  function goToTocItem(href?: string) {
    if (!href) return;
    view?.goTo(href).catch((e) => console.error("TOC navigation failed", e));
    tocOpen = false;
  }

  $effect(() => {
    const scheme = mode.current === "dark" ? "dark" : "light";
    const size = fontSize;
    if (!loading && view) {
      view.renderer?.setStyles?.(contentCSS(scheme, size));
    }
  });

  onMount(() => {
    let disposed = false;

    (async () => {
      try {
        await import("foliate-js/view.js");
        if (disposed) return;
        const v = document.createElement(
          "foliate-view",
        ) as unknown as FoliateView;
        v.style.display = "block";
        v.style.width = "100%";
        v.style.height = "100%";
        container.append(v);
        view = v;
        v.addEventListener("relocate", onRelocate);
        v.addEventListener("load", onDocumentLoad);
        await v.open(file);
        if (disposed) return;
        v.renderer?.setAttribute("max-inline-size", MAX_COLUMN_WIDTH);
        v.renderer?.setAttribute("margin", PAGE_MARGIN);
        v.renderer?.setAttribute("gap", PAGE_GAP);
        v.renderer?.setStyles?.(
          contentCSS(mode.current === "dark" ? "dark" : "light", fontSize),
        );
        bookTitle =
          title || formatMetadataText(v.book.metadata?.title) || file.name;
        bookAuthor = author || formatMetadataText(v.book.metadata?.author);
        toc = v.book.toc ?? [];
        const lastLocation = localStorage.getItem(storageKey) ?? undefined;
        loading = false;
        await v.init({ lastLocation });
      } catch (e) {
        console.error("Failed to open ebook", e);
        error = e instanceof Error ? e.message : "Failed to open ebook";
        loading = false;
      }
    })();

    window.addEventListener("keydown", handleKeydown);
    return () => {
      disposed = true;
      window.removeEventListener("keydown", handleKeydown);
      view?.close();
      view?.remove();
      view = null;
    };
  });
</script>

{#snippet tocList(items: TOCItem[], depth: number)}
  <ul class={depth > 0 ? "ml-4" : ""}>
    {#each items as item, i (i)}
      <li>
        <button
          class="hover:bg-accent w-full rounded px-2 py-1 text-left text-sm {item.href &&
          item.href === currentTocHref
            ? 'bg-accent font-medium'
            : ''}"
          onclick={() => goToTocItem(item.href)}>{item.label}</button>
        {#if item.subitems?.length}
          {@render tocList(item.subitems, depth + 1)}
        {/if}
      </li>
    {/each}
  </ul>
{/snippet}

<svelte:head>
  {#if bookTitle}
    <title>{bookTitle}</title>
  {/if}
</svelte:head>

<div class="bg-background flex h-dvh flex-col">
  {#if chromeVisible}
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-2">
      <Button
        variant="ghost"
        size="icon"
        title="Table of contents"
        disabled={toc.length === 0}
        onclick={() => (tocOpen = true)}><MenuIcon /></Button>
      <div class="min-w-0 flex-1 text-center">
        <span class="block truncate text-sm font-medium">{bookTitle}</span>
        {#if bookAuthor}
          <span class="text-muted-foreground block truncate text-xs"
            >{bookAuthor}</span>
        {/if}
      </div>
      <Button
        variant="ghost"
        size="icon"
        title="Decrease font size"
        disabled={fontSize <= FONT_SIZE_MIN}
        onclick={() => changeFontSize(-FONT_SIZE_STEP)}
        ><AArrowDownIcon /></Button>
      <Button
        variant="ghost"
        size="icon"
        title="Increase font size"
        disabled={fontSize >= FONT_SIZE_MAX}
        onclick={() => changeFontSize(FONT_SIZE_STEP)}><AArrowUpIcon /></Button>
      <Button
        variant="ghost"
        size="icon"
        title="Toggle theme"
        onclick={toggleMode}>
        <SunIcon
          class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <MoonIcon
          class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
      <span class="text-muted-foreground w-16 text-right text-xs"
        >{loading || error ? "" : `${percent}`}</span>
    </header>
  {/if}

  <div class="relative min-h-0 flex-1">
    {#if loading}
      <div class="absolute inset-0 z-10 flex items-center justify-center">
        <Spinner class="size-8" />
      </div>
    {:else if error}
      <div class="absolute inset-0 z-10 flex items-center justify-center p-8">
        <p class="text-destructive text-center">
          Failed to open ebook: {error}
        </p>
      </div>
    {/if}
    <div bind:this={container} class="h-full w-full"></div>
    {#if !chromeVisible && !loading && !error}
      <span
        class="text-muted-foreground pointer-events-none absolute top-0 right-1 text-[10px] leading-none tabular-nums"
        >{percent}</span>
    {/if}
  </div>

  {#if chromeVisible}
    <footer class="flex h-12 shrink-0 items-center gap-2 border-t px-2">
      <Button
        variant="ghost"
        size="icon"
        title="Previous page"
        onclick={() => view?.goLeft()}><ChevronLeftIcon /></Button>
      <input
        type="range"
        class="accent-primary min-w-0 flex-1"
        min="0"
        max="1"
        step="any"
        value={fraction}
        disabled={loading || !!error}
        oninput={onSliderInput}
        title={locationLabel ? `${percent} · ${locationLabel}` : percent} />
      <Button
        variant="ghost"
        size="icon"
        title="Next page"
        onclick={() => view?.goRight()}><ChevronRightIcon /></Button>
    </footer>
  {/if}
</div>

<Sheet.Root bind:open={tocOpen}>
  <Sheet.Content side="left" class="overflow-y-auto">
    <Sheet.Header>
      <Sheet.Title>Contents</Sheet.Title>
    </Sheet.Header>
    <nav class="px-4 pb-4">
      {@render tocList(toc, 0)}
    </nav>
  </Sheet.Content>
</Sheet.Root>

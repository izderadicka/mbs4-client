<script lang="ts">
  import { onMount } from "svelte";
  import { mode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button";
  import * as Sheet from "$lib/components/ui/sheet";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
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
  }: {
    file: File;
    storageKey: string;
    // metadata from the application; when missing, metadata embedded in the
    // book file is used as backup
    title?: string;
    author?: string;
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

  // single text column may grow up to this width; wider views split into
  // two columns (foliate's default 720px switches to 2 columns too early)
  const MAX_COLUMN_WIDTH = "1024px";

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
  function contentCSS(scheme: "light" | "dark"): string {
    return `
      @namespace epub "http://www.idpf.org/2007/ops";
      html {
        color-scheme: ${scheme};
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
    }
  }

  // forward key presses from inside the book's iframe
  function onDocumentLoad(event: Event) {
    const { doc } = (event as CustomEvent<{ doc: Document }>).detail;
    doc.addEventListener("keydown", handleKeydown);
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
    if (!loading && view) {
      view.renderer?.setStyles?.(contentCSS(scheme));
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
        v.renderer?.setStyles?.(
          contentCSS(mode.current === "dark" ? "dark" : "light"),
        );
        bookTitle =
          title ||
          formatMetadataText(v.book.metadata?.title) ||
          file.name;
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
    <span class="text-muted-foreground w-16 text-right text-xs"
      >{loading || error ? "" : `${percent}`}</span>
  </header>

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
  </div>

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

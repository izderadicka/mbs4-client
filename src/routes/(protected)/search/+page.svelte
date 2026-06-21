<script lang="ts">
  import { goto } from "$app/navigation";
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import CoverIcon from "$lib/components/fragments/cover-icon.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Select from "$lib/components/ui/select";
  import UserIcon from "@lucide/svelte/icons/user";
  import LibraryIcon from "@lucide/svelte/icons/library-big";
  import { breadcrumb } from "$lib/globals.svelte";
  import { apiClient } from "$lib/api/client";
  import { MAX_SEARCH_RESULTS } from "$lib/config";
  import { formatName } from "$lib/utils";
  import type { SearchResultItem } from "$lib/api";

  let { data } = $props();
  breadcrumb.path = [{ name: "Search", path: "/search" }];
  const AUTHORS_LIMIT = 2;

  // Live input value, kept in sync with the committed query from the URL so the
  // current text can be carried over when switching search type.
  // svelte-ignore state_referenced_locally
  let query = $state(data.initialQuery ?? "");
  $effect(() => {
    query = data.initialQuery ?? "";
  });

  const WHAT_LABELS = { ebook: "Ebooks", author: "Authors", series: "Series" };

  // Per-type wiring for the autocomplete; ebook uses the component defaults.
  const cfg = $derived(
    data.what === "author"
      ? {
          load: (q: string, signal: AbortSignal) =>
            apiClient.searchAuthor(q, MAX_SEARCH_RESULTS, signal),
          onSelect: (id: number) => goto(`/author/${id}`),
          placeholder: "Search authors…",
          errorText: "Failed to search authors",
        }
      : data.what === "series"
        ? {
            load: (q: string, signal: AbortSignal) =>
              apiClient.searchSeries(q, MAX_SEARCH_RESULTS, signal),
            onSelect: (id: number) => goto(`/series/${id}`),
            placeholder: "Search series…",
            errorText: "Failed to search series",
          }
        : {
            load: undefined,
            onSelect: (id: number) => goto(`/ebook/${id}`),
            placeholder: "Search by title, author, or series…",
            errorText: undefined,
          },
  );

  function goSearch(q: string, what: string) {
    const trimmed = q.trim();
    goto(
      trimmed
        ? `/search?q=${encodeURIComponent(trimmed)}&what=${what}`
        : `/search?what=${what}`,
    );
  }
</script>

{#snippet authorItem({ book }: { book: SearchResultItem })}
  {#if "Author" in book.doc}
    <span class="truncate min-w-0 font-medium"
      >{formatName(book.doc.Author)}</span>
  {/if}
{/snippet}

{#snippet seriesItem({ book }: { book: SearchResultItem })}
  {#if "Series" in book.doc}
    <span class="truncate min-w-0 font-medium">{book.doc.Series.title}</span>
  {/if}
{/snippet}

<div class="flex gap-2 items-start">
  <Select.Root
    type="single"
    value={data.what}
    onValueChange={(v) => goSearch(query, v)}>
    <Select.Trigger class="w-32 shrink-0"
      >{WHAT_LABELS[data.what]}</Select.Trigger>
    <Select.Content>
      <Select.Item value="ebook">Ebooks</Select.Item>
      <Select.Item value="author">Authors</Select.Item>
      <Select.Item value="series">Series</Select.Item>
    </Select.Content>
  </Select.Root>

  <div class="flex-1 min-w-0">
    {#key data.what}
      <BookAutocomplete
        placeholder={cfg.placeholder}
        errorText={cfg.errorText}
        load={cfg.load}
        renderItem={data.what === "author"
          ? authorItem
          : data.what === "series"
            ? seriesItem
            : undefined}
        initialValue={query}
        bind:query
        onSelect={cfg.onSelect}
        onSearch={(q) => goSearch(q, data.what)} />
    {/key}
  </div>
</div>

<div class="mt-4">
  {#if data.results && data.results.length > 0}
    <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {#if data.what === "ebook"}
        {#each data.results as result}
          {@const ebook = result.doc.Ebook}
          <Card.Root class="p-3 overflow-hidden">
            <Card.Content class="flex gap-4 flex-row">
              <div class="w-[100px] h-[138px] mr-4 shrink-0">
                <a href="/ebook/{ebook.id}">
                  <CoverIcon ebookId={ebook.id} size={90} />
                </a>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-lg font-bold truncate">
                  <a href="/ebook/{ebook.id}">{ebook.title}</a>
                </div>
                <div class="italic text-sm text-muted-foreground truncate">
                  {#each ebook.authors.slice(0, AUTHORS_LIMIT) as author, i}
                    <a href="/author/{author.id}">{author.name}</a
                    >{#if i < Math.min(ebook.authors.length, AUTHORS_LIMIT) - 1},
                    {/if}
                  {/each}
                  {#if ebook.authors.length > AUTHORS_LIMIT}
                    and others
                  {/if}
                </div>
                {#if ebook.series}
                  <div class="text-sm truncate">
                    {#if ebook.series_id != null}
                      <a href="/series/{ebook.series_id}"
                        >{ebook.series} #{ebook.series_index}</a>
                    {:else}
                      {ebook.series} #{ebook.series_index}
                    {/if}
                  </div>
                {/if}
              </div>
            </Card.Content>
          </Card.Root>
        {/each}
      {:else if data.what === "author"}
        {#each data.results as result}
          {@const author = result.doc.Author}
          <a href="/author/{author.id}">
            <Card.Root class="p-3 overflow-hidden hover:bg-accent/40">
              <Card.Content class="flex gap-3 flex-row items-center">
                <UserIcon class="size-6 shrink-0 text-muted-foreground" />
                <div class="text-lg font-bold truncate min-w-0">
                  {formatName(author)}
                </div>
              </Card.Content>
            </Card.Root>
          </a>
        {/each}
      {:else}
        {#each data.results as result}
          {@const series = result.doc.Series}
          <a href="/series/{series.id}">
            <Card.Root class="p-3 overflow-hidden hover:bg-accent/40">
              <Card.Content class="flex gap-3 flex-row items-center">
                <LibraryIcon class="size-6 shrink-0 text-muted-foreground" />
                <div class="text-lg font-bold truncate min-w-0">
                  {series.title}
                </div>
              </Card.Content>
            </Card.Root>
          </a>
        {/each}
      {/if}
    </div>
  {:else if data.initialQuery}
    <div class="mt-8 text-xl text-muted-foreground text-center">
      No results found
    </div>
  {:else}
    <div class="mt-8 text-xl text-muted-foreground text-center">
      Type to search for {WHAT_LABELS[data.what].toLowerCase()}
    </div>
  {/if}
</div>

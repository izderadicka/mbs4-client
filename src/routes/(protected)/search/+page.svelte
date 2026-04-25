<script lang="ts">
  import { goto } from "$app/navigation";
  import BookAutocomplete from "$lib/components/fragments/search-autocomplete.svelte";
  import CoverIcon from "$lib/components/fragments/cover-icon.svelte";
  import * as Card from "$lib/components/ui/card";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  breadcrumb.path = [{ name: "Search", path: "/search" }];
</script>

<BookAutocomplete
  placeholder="Search by title, author, or series…"
  initialValue={data.initialQuery ?? ""}
  onSelect={(id) => goto(`/ebook/${id}`)}
  onSearch={(q) => goto(`/search?q=${encodeURIComponent(q)}`)} />

<div class="mt-4">
  {#if data.ebooks && data.ebooks.length > 0}
    <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {#each data.ebooks as result}
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
                {#each ebook.authors.slice(0, 2) as author, i}
                  <a href="/author/{author.id}">{author.name}</a
                  >{#if i < ebook.authors.length - 1},
                  {/if}
                {/each}
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
    </div>
  {:else if data.initialQuery}
    <div class="mt-8 text-xl text-muted-foreground text-center">
      No results found
    </div>
  {:else}
    <div class="mt-8 text-xl text-muted-foreground text-center">
      Type to search for ebooks
    </div>
  {/if}
</div>

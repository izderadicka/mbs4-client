<script lang="ts" module>
  import { type BookshelfItemSorting } from "$lib/api/sorting";

  const SORTING: { label: string; value: BookshelfItemSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Title", value: "title" },
    { label: "Reverse Title", value: "reverse-title" },
    { label: "Order", value: "order" },
    { label: "Reverse Order", value: "reverse-order" },
  ];
</script>

<script lang="ts">
  import type { BookshelfItem, PagedBookshelfItem } from "$lib/api";
  import * as Table from "$lib/components/ui/table/index.js";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import Pager from "$lib/components/pager.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
  import TableIcon from "@lucide/svelte/icons/rows-3";
  import GridIcon from "@lucide/svelte/icons/layout-grid";
  import CoverIcon from "$lib/components/fragments/cover-icon.svelte";
  import { goto } from "$app/navigation";
  import SortSelect from "$lib/components/fragments/sort-select.svelte";

  type Props = {
    items: PagedBookshelfItem;
    sort: BookshelfItemSorting;
  };

  let { items, sort }: Props = $props();

  type Layout = "table" | "grid";
  let layout = $state<Layout>("grid");

  function buildLink(item: BookshelfItem) {
    if (item.ebook_id) {
      return `/ebook/${item.ebook_id}`;
    } else if (item.series_id) {
      return `/series/${item.series_id}`;
    }

    return "";
  }
</script>

<div class="flex gap-2 items-center flex-col md:flex-row">
  <div class="flex gap-2">
    <ButtonGroup.Root>
      <Button
        onclick={() => (layout = "grid")}
        disabled={layout === "grid"}
        class="cursor-pointer"><GridIcon /></Button>
      <Button
        onclick={() => (layout = "table")}
        disabled={layout === "table"}
        class="cursor-pointer"><TableIcon /></Button>
    </ButtonGroup.Root>
    <SortSelect bind:sort sorting={SORTING} />
  </div>
</div>

{#if !items || !items.rows || items.rows.length === 0}
  <div class="mt-4 text-xl text-muted-foreground text-center">
    No items found
  </div>
{:else}
  {#if layout === "grid"}
    <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {#each items.rows as item (item.id)}
        <Card.Root class="p-3 overflow-hidden">
          <Card.Content class="flex gap-4 flex-row">
            <div class="w-[100px] h-[138px] mr-4">
              <a href={buildLink(item)}>
                <CoverIcon ebookId={item.ebook_id || 0} size={90} />
              </a>
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold">
                <a href={buildLink(item)}>{item.title}</a>
              </div>
              <AuthorsList
                authors={item.authors || []}
                short={true}
                class="italic" />
              <!-- {#if item.series}
                <div>
                  <a href="/series/{item.series.id}"
                    >{item.series?.title} #{item.series_index}</a>
                </div>
              {/if} -->
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}

  {#if layout === "table"}
    <Table.Root class="table-fixed w-full">
      <Table.Header>
        <Table.Row>
          <Table.Head class="w-[4rem]">Id</Table.Head>
          <Table.Head class="w-[20%]">Authors</Table.Head>
          <Table.Head>Title</Table.Head>
          <Table.Head class="hidden lg:table-cell">Note</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each items.rows as item (item.id)}
          <Table.Row>
            <Table.Cell class="font-medium">{item.id}</Table.Cell>
            <Table.Cell class="truncate"
              ><AuthorsList
                authors={item.authors || []}
                short={true} /></Table.Cell>
            <Table.Cell class="truncate"
              ><a href={buildLink(item)}>{item.title}</a></Table.Cell>
            <Table.Cell class="truncate hidden lg:table-cell"
              >{item.note}</Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}

  <Pager count={items.total} pageSize={items.page_size} page={items.page} />
{/if}

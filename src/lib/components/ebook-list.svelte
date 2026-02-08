<script lang="ts" module>
  import { type EbookSorting } from "$lib/api/sorting";

  const SORTING: { label: string; value: EbookSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Title", value: "title" },
    { label: "Reverse Title", value: "reverse-title" },
  ];

  const SORTING_SERIES: { label: string; value: EbookSorting }[] = [
    { label: "Newest", value: "latest" },
    { label: "Oldest", value: "oldest" },
    { label: "Title", value: "title" },
    { label: "Reverse Title", value: "reverse-title" },
    { label: "Series Index", value: "series-index" },
    { label: "Rev. Series Idx", value: "reverse-series-index" },
  ];
</script>

<script lang="ts">
  import type { GenreShort, PagedEbookShort } from "$lib/api";
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
  import GenreField from "./fields/genre-field.svelte";
  import { superForm } from "sveltekit-superforms";
  import SortSelect from "$lib/components/fragments/sort-select.svelte";

  type Props = {
    ebooks: PagedEbookShort;
    sort?: EbookSorting;
    genres?: GenreShort[];
    isSeries?: boolean;
  };

  type Layout = "table" | "grid";

  let {
    ebooks,
    sort = $bindable(),
    genres = $bindable(),
    isSeries,
  }: Props = $props();

  let layout = $state<Layout>("grid");

  const buildHref = () => {
    const u = new URL(window.location.href);
    if ($formData.genres) {
      u.searchParams.set(
        "genres",
        $formData.genres?.map((g) => g.id).join(","),
      );
    } else {
      u.searchParams.delete("genres");
    }
    if (sort) {
      u.searchParams.set("sort", sort);
    } else {
      u.searchParams.delete("sort");
    }
    return `${u.pathname}?${u.searchParams.toString()}`;
  };

  function onSortChange(s: string) {
    goto(buildHref());
  }

  const form = superForm(
    { genres },
    {
      SPA: true,
      dataType: "json",
      validators: false,
      onChange: async () => {
        console.log("Changed genres", $formData.genres);
        await goto(buildHref());
      },
    },
  );

  let { form: formData } = form;
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
    <SortSelect
      bind:sort
      {onSortChange}
      sorting={isSeries ? SORTING_SERIES : SORTING} />
  </div>
  <div class="flex-1">
    <GenreField
      {form}
      bind:value={$formData.genres}
      minimal={true}
      placeholder="Select genres to filter ..." />
  </div>
</div>

{#if !ebooks || !ebooks.rows || ebooks.rows.length === 0}
  <div class="mt-4 text-xl text-muted-foreground text-center">
    No ebooks found
  </div>
{:else}
  {#if layout === "grid"}
    <div class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
      {#each ebooks.rows as ebook (ebook.id)}
        <Card.Root class="p-3 overflow-hidden">
          <Card.Content class="flex gap-4 flex-row">
            <div class="w-[100px] h-[138px] mr-4">
              <a href="/ebook/{ebook.id}">
                <CoverIcon ebookId={ebook.id} size={90} />
              </a>
            </div>
            <div class="flex-1">
              <div class="text-lg font-bold">
                <a href="/ebook/{ebook.id}">{ebook.title}</a>
              </div>
              <AuthorsList
                authors={ebook.authors || []}
                short={true}
                class="italic" />
              {#if ebook.series}
                <div>
                  <a href="/series/{ebook.series.id}"
                    >{ebook.series?.title} #{ebook.series_index}</a>
                </div>
              {/if}
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
          <Table.Head class="hidden lg:table-cell">Series</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each ebooks.rows as ebook (ebook.id)}
          <Table.Row>
            <Table.Cell class="font-medium">{ebook.id}</Table.Cell>
            <Table.Cell class="truncate"
              ><AuthorsList
                authors={ebook.authors || []}
                short={true} /></Table.Cell>
            <Table.Cell class="truncate"
              ><a href="/ebook/{ebook.id}">{ebook.title}</a></Table.Cell>
            <Table.Cell class="truncate hidden lg:table-cell">
              {#if ebook.series}
                <a href="/series/{ebook.series.id}"
                  >{ebook.series.title} #{ebook.series_index}</a>
              {/if}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/if}

  <Pager count={ebooks.total} pageSize={ebooks.page_size} page={ebooks.page} />
{/if}

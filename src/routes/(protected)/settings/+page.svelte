<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import Label from "$lib/components/ui/label/label.svelte";
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import GridIcon from "@lucide/svelte/icons/layout-grid";
  import TableIcon from "@lucide/svelte/icons/rows-3";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import {
    appSettings,
    setPageSize,
    setEbookLayout,
    setSearchResultsLimit,
    setOnlineSearches,
    PAGE_SIZES,
    SEARCH_RESULT_LIMITS,
    type PageSize,
    type SearchResultLimit,
    type OnlineSearch,
  } from "$lib/settings.svelte";

  breadcrumb.path = [{ name: "Settings", path: "/settings" }];

  let pageSizeStr = $state(String(appSettings.pageSize));
  let searchLimitStr = $state(String(appSettings.searchResultsLimit));

  let searches: OnlineSearch[] = $state(
    appSettings.onlineSearches.map((s) => ({ ...s })),
  );

  function persistSearches() {
    setOnlineSearches(searches);
  }

  function addSearch() {
    searches.push({ name: "", urlTemplate: "" });
  }

  function removeSearch(index: number) {
    searches.splice(index, 1);
    persistSearches();
  }
</script>

<Title>Settings</Title>

<div class="flex flex-col gap-6 max-w-2xl">

  <Card.Root>
    <Card.Header>
      <Card.Title>Display</Card.Title>
      <Card.Description>Default layout and pagination for list views.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">

      <div class="flex items-center gap-4">
        <Label class="w-44 shrink-0">Default page size</Label>
        <Select.Root
          type="single"
          bind:value={pageSizeStr}
          onValueChange={(v) => setPageSize(Number(v) as PageSize)}
        >
          <Select.Trigger class="w-24">{pageSizeStr}</Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each PAGE_SIZES as size}
                <Select.Item value={String(size)}>{size}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex items-center gap-4">
        <Label class="w-44 shrink-0">Default ebooks list layout</Label>
        <ButtonGroup.Root>
          <Button
            onclick={() => setEbookLayout("grid")}
            disabled={appSettings.ebookLayout === "grid"}
            class="cursor-pointer gap-1"
          ><GridIcon class="size-4" /> Grid</Button>
          <Button
            onclick={() => setEbookLayout("table")}
            disabled={appSettings.ebookLayout === "table"}
            class="cursor-pointer gap-1"
          ><TableIcon class="size-4" /> Table</Button>
        </ButtonGroup.Root>
      </div>

    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Search</Card.Title>
      <Card.Description>Number of results returned when searching.</Card.Description>
    </Card.Header>
    <Card.Content>
      <div class="flex items-center gap-4">
        <Label class="w-44 shrink-0">Search results limit</Label>
        <Select.Root
          type="single"
          bind:value={searchLimitStr}
          onValueChange={(v) => setSearchResultsLimit(Number(v) as SearchResultLimit)}
        >
          <Select.Trigger class="w-24">{searchLimitStr}</Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each SEARCH_RESULT_LIMITS as limit}
                <Select.Item value={String(limit)}>{limit}</Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
      </div>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title>Online Search</Card.Title>
      <Card.Description>
        Search engines available from the ebook detail page. Placeholders:
        <code>{"{title}"}</code>, <code>{"{series}"}</code>,
        <code>{"{author}"}</code>, <code>{"{author_first}"}</code>,
        <code>{"{author_last}"}</code>. All author placeholders are left empty
        when the ebook has more than one author.
      </Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#each searches as search, i (i)}
        <div class="flex items-start gap-2">
          <div class="flex flex-col gap-1 flex-1 min-w-0">
            <Input
              placeholder="Name (e.g. Databáze knih)"
              bind:value={search.name}
              onblur={persistSearches} />
            <Input
              placeholder="https://example.com/search?q={'{title}'}+{'{author_last}'}"
              bind:value={search.urlTemplate}
              onblur={persistSearches} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove search engine"
            onclick={() => removeSearch(i)}
            class="shrink-0">
            <TrashIcon class="size-4" />
          </Button>
        </div>
      {/each}
      <Button variant="outline" onclick={addSearch} class="self-start gap-1">
        <PlusIcon class="size-4" /> Add search engine
      </Button>
    </Card.Content>
  </Card.Root>

</div>

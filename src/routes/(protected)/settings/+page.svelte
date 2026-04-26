<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import Label from "$lib/components/ui/label/label.svelte";
  import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import GridIcon from "@lucide/svelte/icons/layout-grid";
  import TableIcon from "@lucide/svelte/icons/rows-3";
  import {
    appSettings,
    setPageSize,
    setEbookLayout,
    setSearchResultsLimit,
    PAGE_SIZES,
    SEARCH_RESULT_LIMITS,
    type PageSize,
    type SearchResultLimit,
  } from "$lib/settings.svelte";

  breadcrumb.path = [{ name: "Settings", path: "/settings" }];

  let pageSizeStr = $state(String(appSettings.pageSize));
  let searchLimitStr = $state(String(appSettings.searchResultsLimit));
</script>

<Title>Settings</Title>

<div class="flex flex-col gap-6 max-w-lg">

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

</div>

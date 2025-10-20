<script lang="ts" module>
  const PAGE_SIZES = [10, 25, 50, 100];
</script>

<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { MediaQuery } from "svelte/reactivity";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import { goto } from "$app/navigation";
  import Label from "./ui/label/label.svelte";
  import * as Select from "$lib/components/ui/select/index.js";

  type Props = {
    count: number;
    pageSize: number;
    page: number;
  };
  let { count, pageSize, page }: Props = $props();

  const isDesktop = new MediaQuery("(min-width: 768px)");

  const siblingCount = $derived(isDesktop.current ? 3 : 0);
  let perPage: string = $state(String(pageSize));
  let perPageNumber = $derived(Number(perPage));

  const buildHref = (p: number) => {
    const u = new URL(window.location.href);
    u.searchParams.set("page", String(p));
    u.searchParams.set("page_size", String(perPage));
    return `${u.pathname}?${u.searchParams.toString()}`;
  };

  function onPageChange(p: number) {
    goto(buildHref(p));
  }
</script>

<Pagination.Root
  {count}
  perPage={perPageNumber}
  {siblingCount}
  {page}
  {onPageChange}
>
  {#snippet children({ pages, currentPage })}
    <Pagination.Content>
      <Pagination.Item>
        <Pagination.PrevButton>
          <ChevronLeftIcon class="size-4" />
          <span class="hidden sm:block">Previous</span>
        </Pagination.PrevButton>
      </Pagination.Item>
      {#each pages as page (page.key)}
        {#if page.type === "ellipsis"}
          <Pagination.Item>
            <Pagination.Ellipsis />
          </Pagination.Item>
        {:else}
          <Pagination.Item>
            <Pagination.Link {page} isActive={currentPage === page.value}>
              {page.value}
            </Pagination.Link>
          </Pagination.Item>
        {/if}
      {/each}
      <Pagination.Item>
        <Pagination.NextButton>
          <span class="hidden sm:block">Next</span>
          <ChevronRightIcon class="size-4" />
        </Pagination.NextButton>
      </Pagination.Item>
    </Pagination.Content>
    <Label for="page-size" class="mr-1 hidden sm:flex">Page Size</Label>
    <Select.Root
      bind:value={perPage}
      type="single"
      name="page-size"
      onValueChange={(_) => onPageChange(page)}
    >
      <Select.Trigger class="w-[4rem]">
        {perPage}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each PAGE_SIZES as size}
            <Select.Item value={String(size)}>
              {size}
            </Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  {/snippet}
</Pagination.Root>

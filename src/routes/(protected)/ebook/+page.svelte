<script lang="ts">
  import * as Table from "$lib/components/ui/table/index.js";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import AuthorsList from "$lib/components/fragments/authors-list.svelte";
  import Title from "$lib/components/title.svelte";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { MediaQuery } from "svelte/reactivity";
  import * as Pagination from "$lib/components/ui/pagination/index.js";
  import { goto } from "$app/navigation";

  const { data } = $props();
  const ebooks = $derived(data.ebooks);

  breadcrumb.path = [{ name: "Ebooks", path: "/ebook" }];

  const isDesktop = new MediaQuery("(min-width: 768px)");

  const count = $derived(ebooks.total * ebooks.page_size);
  const siblingCount = $derived(isDesktop.current ? 3 : 1);

  const buildHref = (p: number) => {
    const u = new URL(window.location.href);
    u.searchParams.set("page", String(p));
    u.searchParams.set("page_size", String(ebooks.page_size));
    return `${u.pathname}?${u.searchParams.toString()}`;
  };

  function onPageChange(p: number) {
    goto(buildHref(p));
  }
</script>

<Title>All Ebooks</Title>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>Id</Table.Head>
      <Table.Head>Authors</Table.Head>
      <Table.Head>Title</Table.Head>
      <Table.Head>Series</Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each ebooks.rows as ebook (ebook.id)}
      <Table.Row>
        <Table.Cell class="font-medium">{ebook.id}</Table.Cell>
        <Table.Cell
          ><AuthorsList
            authors={ebook.authors || []}
            short={true}
          /></Table.Cell
        >
        <Table.Cell><a href="/ebook/{ebook.id}">{ebook.title}</a></Table.Cell>
        <Table.Cell>
          {#if ebook.series}
            <a href="/series/{ebook.series.id}">{ebook.series.title}</a>
          {/if}
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

<Pagination.Root
  {count}
  perPage={ebooks.page_size}
  {siblingCount}
  page={ebooks.page}
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
  {/snippet}
</Pagination.Root>

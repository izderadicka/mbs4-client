<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Bookshelf } from "$lib/api/index.js";
  import BookshelfForm from "$lib/components/bookshelf-form.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  let bookshelf = $derived(data.bookshelf);

  breadcrumb.path = [
    { name: "My Bookshelfs", path: "/bookshelf" },
    // svelte-ignore state_referenced_locally
    {
      name: bookshelf.name,
      path: "/bookshelf/" + bookshelf.id,
    },
    { name: "Edit" },
  ];

  async function onCancel() {
    await goto("/bookshelf/" + bookshelf.id);
  }

  async function afterUpdate(bookshelf: Bookshelf) {
    await goto("/bookshelf/" + bookshelf.id);
  }

  async function afterDelete(id: number) {
    await goto("/bookshelf");
  }
</script>

<Title>Edit Bookshelf</Title>

<BookshelfForm
  bookshelfData={bookshelf}
  {onCancel}
  {afterUpdate}
  {afterDelete} />

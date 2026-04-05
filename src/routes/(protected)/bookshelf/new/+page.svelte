<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Bookshelf } from "$lib/api";
  import BookshelfForm from "$lib/components/bookshelf-form.svelte";
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";

  breadcrumb.path = [
    { name: "My Bookshelves", path: "/bookshelf" },
    { name: "New Bookshelf" },
  ];

  async function onCancel() {
    await goto("/bookshelf");
  }

  async function afterCreate(bookshelf: Bookshelf) {
    await goto(`/bookshelf/${bookshelf.id}`);
  }
</script>

<Title>New Bookshelf</Title>

<BookshelfForm {onCancel} {afterCreate} />

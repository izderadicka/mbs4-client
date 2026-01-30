<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Author } from "$lib/api/index.js";
  import AuthorForm from "$lib/components/author-form.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte";

  let { data } = $props();
  let author = $derived(data.author);
  let hasBooks = $derived(data.hasBooks);

  breadcrumb.path = [
    { name: "Authors", path: "/author" },
    // svelte-ignore state_referenced_locally
    {
      name: author.first_name
        ? author.first_name + " " + author.last_name
        : author.last_name,
      path: "/author/" + author.id,
    },
    { name: "Edit" },
  ];

  async function onCancel() {
    await goto("/author/" + author.id);
  }

  async function afterUpdate(author: Author) {
    await goto("/author/" + author.id);
  }

  async function afterDelete(id: number) {
    await goto("/author");
  }
</script>

<Title>Edit Author</Title>

<AuthorForm
  authorData={author}
  {onCancel}
  {afterUpdate}
  {afterDelete}
  {hasBooks} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Author } from "$lib/api";
  import AuthorForm from "$lib/components/author-form.svelte";
  import Title from "$lib/components/title.svelte";

  async function onCancel() {
    await goto("/author");
  }

  async function afterCreate(author: Author) {
    await goto("/author/" + author.id);
  }
</script>

<Title>New Author</Title>
<p class="italic text-muted-foreground">
  But better way is to create new author during ebook file upload
</p>

<AuthorForm {onCancel} {afterCreate} />

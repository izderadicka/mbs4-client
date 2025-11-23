<script lang="ts">
  import { type Author } from "$lib/api";
  import Title from "$lib/components/title.svelte";

  type props = {
    data: {
      author: Author;
    };
  };
  let { data } = $props();
  let author = $derived(data.author);
</script>

<Title>
  {author.first_name}
  {author.last_name}
</Title>

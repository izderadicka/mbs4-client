<script lang="ts">
  import type { AuthorShort } from "$lib/api";

  let { authors, short = false }: { authors: AuthorShort[]; short?: boolean } =
    $props();
  if (short) {
    authors = authors.slice(0, 2);
  }
</script>

<span>
  {#each authors as author, i}
    <a href={`/author/${author.id}`}
      >{#if author.first_name}<span>{author.first_name} </span>{/if}
      <span>{author.last_name}</span></a
    >
    {i < authors.length - 1 ? ", " : ""}
  {/each}
</span>

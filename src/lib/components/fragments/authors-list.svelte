<script lang="ts">
  type AuthorShort = {
    id?: number;
    first_name?: string | null;
    last_name: string;
  };
  let { authors, short = false }: { authors: AuthorShort[]; short?: boolean } =
    $props();
  if (short) {
    authors = authors.slice(0, 2);
  }
</script>

{#snippet authorSnippet(author: AuthorShort)}
  {#if author.first_name}<span>{author.first_name} </span>{/if}
  <span>{author.last_name}</span>
{/snippet}

<span>
  {#each authors as author, i}
    {#if author.id != null}
      <a href={`/author/${author.id}`}>{@render authorSnippet(author)}</a>
    {:else}
      {@render authorSnippet(author)}
    {/if}
    {i < authors.length - 1 ? ", " : ""}
  {/each}
</span>

<script lang="ts">
  import { formatName } from "$lib/utils";
  import { type HTMLAttributes } from "svelte/elements";

  type AuthorShort = {
    id?: number;
    first_name?: string | null;
    last_name: string;
  };
  type SpanAttributes = HTMLAttributes<HTMLSpanElement>;

  let {
    authors,
    short = false,
    ...restProps
  }: { authors: AuthorShort[]; short?: boolean } & SpanAttributes = $props();
  if (short) {
    authors = authors.slice(0, 2);
  }
</script>

{#snippet authorSnippet(author: AuthorShort)}
  {formatName(author)}
{/snippet}

<span {...restProps}>
  {#each authors as author, i}
    {#if author.id != null}
      <a href={`/author/${author.id}`}>{@render authorSnippet(author)}</a>
    {:else}
      {@render authorSnippet(author)}
    {/if}
    {i < authors.length - 1 ? ", " : ""}
  {/each}
</span>

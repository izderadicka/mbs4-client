<script lang="ts" module>
  // Longer texts are clamped and expanded on demand. Counting characters is a
  // rough proxy for rendered height, but it avoids measuring the layout.
  export const COLLAPSE_THRESHOLD = 500;

  export function isBlank(text: string | null | undefined): boolean {
    return !text || !text.trim();
  }
</script>

<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import Subtitle from "$lib/components/subtitle.svelte";
  import { cn } from "$lib/utils";

  let {
    text = null,
    label = undefined,
    class: className,
  }: {
    text?: string | null;
    label?: string;
    class?: string;
  } = $props();

  let expanded = $state(false);

  let content = $derived(text?.trim() ?? "");
  let collapsible = $derived(content.length > COLLAPSE_THRESHOLD);
</script>

{#if !isBlank(text)}
  <div class={cn("space-y-1", className)}>
    {#if label}
      <Subtitle level={2}>{label}</Subtitle>
    {/if}
    <p
      class={cn(
        "text-muted-foreground whitespace-pre-line text-sm",
        collapsible && !expanded && "line-clamp-6",
      )}>
      {content}
    </p>
    {#if collapsible}
      <Button
        variant="link"
        class="h-auto px-0"
        onclick={() => (expanded = !expanded)}>
        {expanded ? "Show less" : "Show more"}
      </Button>
    {/if}
  </div>
{/if}

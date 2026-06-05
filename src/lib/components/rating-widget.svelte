<script lang="ts" module>
  type StarFill = "full" | "half" | "empty";

  export function starFill(value: number | null | undefined, i: number): StarFill {
    if (value == null) return "empty";
    const fullT = (i + 1) * 20;
    const halfT = i * 20 + 10;
    if (value >= fullT) return "full";
    if (value >= halfT) return "half";
    return "empty";
  }
</script>

<script lang="ts">
  import Star from "@lucide/svelte/icons/star";
  import XCircle from "@lucide/svelte/icons/x-circle";
  import { toast } from "svelte-sonner";
  import { cn } from "$lib/utils";

  type Mode = "view" | "interactive";

  type Props = {
    rating?: number | null;
    count?: number | null;
    mode?: Mode;
    userRating?: number | null;
    onRate?: (rating: number) => Promise<void>;
    onDelete?: () => Promise<void>;
    class?: string;
  };

  let {
    rating = null,
    count = null,
    mode = "view",
    userRating = null,
    onRate,
    onDelete,
    class: className,
  }: Props = $props();

  let hoverValue = $state<number | null>(null);
  let busy = $state(false);

  const STARS = [0, 1, 2, 3, 4];

  let interactiveValue = $derived(hoverValue ?? userRating ?? 0);

  function valueFromEvent(e: PointerEvent | MouseEvent, i: number): number {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x < rect.width / 2 ? i * 20 + 10 : (i + 1) * 20;
  }

  async function handleClick(e: MouseEvent, i: number) {
    if (busy || !onRate) return;
    const value = valueFromEvent(e, i);
    busy = true;
    try {
      await onRate(value);
    } catch (err) {
      console.error("Rating failed", err);
      toast.error("Failed to set rating");
    } finally {
      busy = false;
    }
  }

  async function handleDelete() {
    if (busy || !onDelete) return;
    busy = true;
    try {
      await onDelete();
      hoverValue = null;
    } catch (err) {
      console.error("Delete rating failed", err);
      toast.error("Failed to clear rating");
    } finally {
      busy = false;
    }
  }
</script>

{#snippet starRow(value: number | null | undefined, size: string)}
  <span class="inline-flex items-center gap-0.5">
    {#each STARS as i (i)}
      {@const fill = starFill(value, i)}
      <span class="relative inline-block {size}">
        <Star class="{size} text-muted-foreground" />
        {#if fill !== "empty"}
          <span
            class="absolute inset-0 overflow-hidden"
            style={fill === "half"
              ? "clip-path: inset(0 50% 0 0)"
              : undefined}>
            <Star class="{size} text-yellow-500 fill-yellow-500" />
          </span>
        {/if}
      </span>
    {/each}
  </span>
{/snippet}

{#snippet interactiveRow()}
  <div class={cn("flex items-center gap-2", className)}>
    <div
      class="inline-flex items-center gap-0.5"
      onpointerleave={() => (hoverValue = null)}
      role="group"
      aria-label="Rate this ebook">
      {#each STARS as i (i)}
        {@const fill = starFill(interactiveValue, i)}
        <button
          type="button"
          class="relative inline-block size-7 cursor-pointer p-0 bg-transparent border-0 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          aria-label={`Rate ${i + 1} stars`}
          onpointermove={(e) => (hoverValue = valueFromEvent(e, i))}
          onclick={(e) => handleClick(e, i)}>
          <Star class="size-7 text-muted-foreground" />
          {#if fill !== "empty"}
            <span
              class="absolute inset-0 overflow-hidden pointer-events-none"
              style={fill === "half"
                ? "clip-path: inset(0 50% 0 0)"
                : undefined}>
              <Star class="size-7 text-yellow-500 fill-yellow-500" />
            </span>
          {/if}
        </button>
      {/each}
    </div>
    {#if userRating != null}
      <button
        type="button"
        class="inline-flex items-center justify-center size-7 text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-0 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        aria-label="Clear my rating"
        title="Clear my rating"
        onclick={handleDelete}>
        <XCircle class="size-5" />
      </button>
    {/if}
  </div>
{/snippet}

{#if mode === "view"}
  <span class={cn("inline-flex items-center gap-1 text-sm", className)}>
    {@render starRow(rating, "size-4")}
    <span class="text-muted-foreground">({count ?? 0})</span>
  </span>
{:else}
  {@render interactiveRow()}
{/if}

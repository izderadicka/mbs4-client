<script lang="ts">
  import type { EbookRating } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { appUser } from "$lib/globals.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Textarea } from "$lib/components/ui/textarea";
  import RatingWidget from "$lib/components/rating-widget.svelte";
  import { toast } from "svelte-sonner";

  const PAGE_SIZE = 20;

  let {
    ebookId,
    average,
    count,
    myRating,
    myReview,
    onRate,
    onDeleteRating,
    onSaveReview,
  }: {
    ebookId: number;
    average: number | null;
    count: number | null;
    myRating: number | null;
    myReview: string | null;
    onRate: (value: number) => Promise<void>;
    onDeleteRating: () => Promise<void>;
    onSaveReview: (text: string | null) => Promise<void>;
  } = $props();

  let dialogOpen = $state(false);
  let text = $state("");
  let hadReview = $state(false);
  let submitting = $state(false);

  let otherRatings: EbookRating[] = $state([]);
  let loadingList = $state(false);
  let page = $state(1);
  let totalPages = $state(1);

  // rating is stored on a 0-100 scale (5 stars * 20 points each)
  let averageStars = $derived(average != null ? average / 20 : null);

  export function open() {
    text = myReview ?? "";
    hadReview = !!myReview;
    dialogOpen = true;
    page = 1;
    otherRatings = [];
    loadRatings();
  }

  export function close() {
    dialogOpen = false;
  }

  async function loadRatings() {
    loadingList = true;
    try {
      const res = await apiClient.listEbookRatings(ebookId, {
        page,
        page_size: PAGE_SIZE,
      });
      const rows = res.rows.filter(
        (r) => r.created_by !== appUser.user?.email,
      );
      otherRatings = page === 1 ? rows : [...otherRatings, ...rows];
      totalPages = res.total_pages;
    } catch (error) {
      console.error("Failed to load reviews", error);
      toast.error("Failed to load reviews");
    } finally {
      loadingList = false;
    }
  }

  function loadMore() {
    page += 1;
    loadRatings();
  }

  async function saveReview(value: string | null) {
    submitting = true;
    try {
      await onSaveReview(value);
      text = value ?? "";
      hadReview = value != null;
    } catch (error) {
      console.error("Failed to save review", error);
      toast.error("Failed to save review");
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Ratings & reviews</Dialog.Title>
      <Dialog.Description>
        {#if averageStars != null}
          {averageStars.toFixed(1)}★ average · {count ?? 0} rating{count === 1
            ? ""
            : "s"}
        {:else}
          No ratings yet
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <div class="space-y-2">
        <h3 class="text-sm font-medium">My rating</h3>
        <RatingWidget
          mode="interactive"
          userRating={myRating}
          {onRate}
          onDelete={onDeleteRating} />
        <Textarea bind:value={text} rows={4} aria-label="My review" />
        {#if myRating == null}
          <p class="text-muted-foreground text-sm">
            Rate the ebook above to add a written review.
          </p>
        {/if}
        <div class="flex justify-end gap-2">
          {#if hadReview}
            <Button
              variant="destructive"
              size="sm"
              disabled={submitting}
              onclick={() => saveReview(null)}>Remove review</Button>
          {/if}
          <Button
            size="sm"
            disabled={submitting || myRating == null}
            onclick={() => saveReview(text.trim() || null)}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div class="space-y-2">
        <h3 class="text-sm font-medium">All reviews</h3>
        <ScrollArea class="h-64">
          <ul class="space-y-2">
            {#each otherRatings as r (r.id)}
              <li class="rounded border p-2 space-y-1">
                <div class="flex items-center justify-between gap-2">
                  <RatingWidget rating={r.rating} mode="view" showCount={false} />
                  <span class="text-muted-foreground text-xs"
                    >{r.created_by ?? "—"}</span>
                </div>
                {#if r.description}
                  <p class="text-sm whitespace-pre-line">{r.description}</p>
                {/if}
              </li>
            {/each}
            {#if otherRatings.length === 0 && !loadingList && page === 1}
              <li class="text-muted-foreground text-sm">
                No reviews from other readers yet.
              </li>
            {/if}
          </ul>
        </ScrollArea>
        {#if page < totalPages}
          <Button
            variant="link"
            class="h-auto px-0"
            disabled={loadingList}
            onclick={loadMore}>
            {loadingList ? "Loading..." : "Load more"}
          </Button>
        {/if}
      </div>
    </div>

    <Dialog.Footer class="mt-6">
      <Button variant="outline" onclick={close}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

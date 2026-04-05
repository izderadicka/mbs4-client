<script lang="ts">
  import type { BookshelfListing, CreateBookshelfItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { bookshelfSortQuery } from "$lib/api/sorting";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { Textarea } from "$lib/components/ui/textarea";
  import { toast } from "svelte-sonner";

  let {
    title,
    ebookId = undefined,
    seriesId = undefined,
    itemType,
  }: {
    title: string;
    ebookId?: number;
    seriesId?: number;
    itemType: "EBOOK" | "SERIES";
  } = $props();

  let dialogOpen = $state(false);
  let loadingBookshelves = $state(false);
  let submitting = $state(false);
  let bookshelves = $state<BookshelfListing[]>([]);
  let selectedBookshelfId = $state("");
  let note = $state("");
  let order = $state<number | null>(null);

  function resetForm() {
    selectedBookshelfId = "";
    note = "";
    order = null;
  }

  async function loadBookshelves() {
    loadingBookshelves = true;
    try {
      const data = await apiClient.listBookshelves(false, {
        page: 1,
        page_size: 100,
        sort: bookshelfSortQuery("name"),
      });
      bookshelves = data.rows;
    } catch (error) {
      console.error("Failed to load bookshelves", error);
      toast.error("Failed to load bookshelves");
    } finally {
      loadingBookshelves = false;
    }
  }

  export async function open() {
    dialogOpen = true;
    resetForm();
    await loadBookshelves();
  }

  export function close() {
    dialogOpen = false;
  }

  async function onSubmit() {
    if (!selectedBookshelfId) {
      toast.error("Select a bookshelf");
      return;
    }

    if (order != null && !Number.isInteger(order)) {
      toast.error("Order must be a whole number");
      return;
    }

    if (order != null && order < 0) {
      toast.error("Order must not be negative");
      return;
    }

    const item: CreateBookshelfItem = {
      item_type: itemType,
      note: note.trim() || null,
      order,
      ebook_id: ebookId,
      series_id: seriesId,
    };

    submitting = true;
    try {
      await apiClient.addBookshelfItem(Number(selectedBookshelfId), item);
      toast.success(`Added "${title}" to bookshelf`);
      dialogOpen = false;
    } catch (error) {
      console.error("Failed to add item to bookshelf", error);
      toast.error("Failed to add item to bookshelf");
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Add to bookshelf</Dialog.Title>
      <Dialog.Description>
        Add "{title}" to one of your bookshelves.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-sm font-medium" for="bookshelf-select">Bookshelf</label>
        <Select.Root type="single" bind:value={selectedBookshelfId}>
          <Select.Trigger id="bookshelf-select" class="w-full">
            {#if selectedBookshelfId}
              {bookshelves.find((bookshelf) => bookshelf.id === Number(selectedBookshelfId))?.name}
            {:else if loadingBookshelves}
              Loading bookshelves...
            {:else}
              Select a bookshelf...
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each bookshelves as bookshelf (bookshelf.id)}
              <Select.Item value={String(bookshelf.id)}>
                {bookshelf.name}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        {#if !loadingBookshelves && bookshelves.length === 0}
          <p class="text-sm text-muted-foreground">No bookshelves found. Create one first.</p>
        {/if}
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium" for="bookshelf-item-note">Note</label>
        <Textarea
          id="bookshelf-item-note"
          bind:value={note}
          placeholder="Optional note for this item" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium" for="bookshelf-item-order">Order</label>
        <Input
          id="bookshelf-item-order"
          type="number"
          min="0"
          step="1"
          bind:value={order}
          placeholder="Optional position" />
      </div>
    </div>

    <Dialog.Footer class="mt-6">
      <Button variant="outline" onclick={close} disabled={submitting}>Cancel</Button>
      <Button
        onclick={onSubmit}
        disabled={submitting || loadingBookshelves || bookshelves.length === 0}>
        {submitting ? "Adding..." : "Add to bookshelf"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

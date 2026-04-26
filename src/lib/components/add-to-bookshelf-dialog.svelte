<script lang="ts">
  import type { BookshelfListing, CreateBookshelfItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { bookshelfSortQuery } from "$lib/api/sorting";
  import * as Form from "$lib/components/ui/form";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { Textarea } from "$lib/components/ui/textarea";
  import { AddToBookshelfSchema } from "$lib/schemas";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import { toast } from "svelte-sonner";

  const LAST_BOOKSHELF_KEY = "mbs4.last-bookshelf-id";

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

  const initialData = {
    bookshelf_id: 0,
    note: null as string | null,
    order: null as number | null,
  };

  const form = superForm(initialData, {
    SPA: true,
    dataType: "json",
    validators: zod4Client(AddToBookshelfSchema),
    onUpdate: async ({ form }) => {
      if (!form.valid) {
        return;
      }

      const item: CreateBookshelfItem = {
        item_type: itemType,
        note: form.data.note?.trim() || null,
        order: form.data.order,
        ebook_id: ebookId,
        series_id: seriesId,
      };

      submitting = true;
      try {
        await apiClient.addBookshelfItem(form.data.bookshelf_id, item);
        toast.success(`Added "${title}" to bookshelf`);
        dialogOpen = false;
      } catch (error) {
        console.error("Failed to add item to bookshelf", error);
        toast.error("Failed to add item to bookshelf");
      } finally {
        submitting = false;
      }
    },
  });

  const { form: formData, enhance } = form;

  let dialogOpen = $state(false);
  let loadingBookshelves = $state(false);
  let submitting = $state(false);
  let bookshelves = $state<BookshelfListing[]>([]);
  let selectedBookshelfId = $state("");

  function resetForm() {
    $formData = {
      bookshelf_id: 0,
      note: null,
      order: null,
    };
    selectedBookshelfId = "";
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

  function saveLastBookshelfId(value: string) {
    localStorage.setItem(LAST_BOOKSHELF_KEY, value);
  }

  function loadLastBookshelfId() {
    return localStorage.getItem(LAST_BOOKSHELF_KEY) || "";
  }

  function onBookshelfChange(value: string) {
    selectedBookshelfId = value;
    $formData.bookshelf_id = Number(value);
    saveLastBookshelfId(value);
  }

  export async function open() {
    dialogOpen = true;
    resetForm();
    await loadBookshelves();
    const lastBookshelfId = loadLastBookshelfId();
    if (lastBookshelfId && bookshelves.some((bookshelf) => bookshelf.id === Number(lastBookshelfId))) {
      onBookshelfChange(lastBookshelfId);
    }
  }

  export function close() {
    dialogOpen = false;
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

    <form method="POST" use:enhance class="space-y-4">
      <Form.Field {form} name="bookshelf_id">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Bookshelf</Form.Label>
            <Select.Root
              type="single"
              value={selectedBookshelfId}
              onValueChange={onBookshelfChange}>
              <Select.Trigger {...props} class="w-full">
                {#if selectedBookshelfId}
                  {bookshelves.find(
                    (bookshelf) => bookshelf.id === Number(selectedBookshelfId),
                  )?.name}
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
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
        {#if !loadingBookshelves && bookshelves.length === 0}
          <Form.Description>
            No bookshelves found. Create one first.
          </Form.Description>
        {:else}
          <Form.Description>
            Choose which bookshelf should contain this item.
          </Form.Description>
        {/if}
        <div>
          <Button href="/bookshelf/new" variant="link" class="h-auto px-0">
            Create new bookshelf
          </Button>
        </div>
      </Form.Field>

      <Form.Field {form} name="note">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Note</Form.Label>
            <Textarea
              {...props}
              bind:value={$formData.note} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
        <Form.Description>
          Optional note shown with this bookshelf item.
        </Form.Description>
      </Form.Field>

      <Form.Field {form} name="order">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Order</Form.Label>
            <Input
              {...props}
              type="number"
              step="1"
              bind:value={$formData.order} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
       <Form.Description>
          Optional manual position inside the bookshelf.
        </Form.Description>
      </Form.Field>

      <Dialog.Footer class="mt-6">
        <Button variant="outline" onclick={close} disabled={submitting}
          >Cancel</Button>
        <Button
          type="submit"
          disabled={submitting ||
            loadingBookshelves ||
            bookshelves.length === 0}>
          {submitting ? "Adding..." : "Add to bookshelf"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<script lang="ts">
  import type { BookshelfItem } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import * as Form from "$lib/components/ui/form";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { EditBookshelfItemSchema } from "$lib/schemas";
  import { Textarea } from "$lib/components/ui/textarea";
  import { zod4Client } from "sveltekit-superforms/adapters";
  import { superForm } from "sveltekit-superforms";
  import { toast } from "svelte-sonner";

  let {
    bookshelfId,
    onUpdated,
  }: {
    bookshelfId: number;
    onUpdated: (item: BookshelfItem, note: string | null) => Promise<void> | void;
  } = $props();

  let dialogOpen = $state(false);
  let submitting = $state(false);
  let item = $state<BookshelfItem | null>(null);

  const form = superForm(
    {
      note: null as string | null,
      order: null as number | null,
    },
    {
      SPA: true,
      dataType: "json",
      validators: zod4Client(EditBookshelfItemSchema),
      onUpdate: async ({ form }) => {
        if (!form.valid || !item) {
          return;
        }

        if (item.version == null) {
          toast.error("Cannot edit item: missing version data");
          return;
        }

        submitting = true;
        try {
          await apiClient.updateBookshelfItem(bookshelfId, {
            id: item.id,
            version: item.version,
            note: form.data.note?.trim() || null,
            order: form.data.order,
          });
          await onUpdated(item, form.data.note?.trim() || null);
          dialogOpen = false;
          toast.success("Bookshelf item updated");
        } catch (error) {
          console.error("Failed to update bookshelf item", error);
          toast.error("Failed to update bookshelf item");
        } finally {
          submitting = false;
        }
      },
    },
  );

  const { form: formData, enhance } = form;

  export function openDialog(nextItem: BookshelfItem) {
    item = nextItem;
    $formData = {
      note: item.note || null,
      order: item.order ?? null,
    };
    dialogOpen = true;
  }

  function closeDialog() {
    dialogOpen = false;
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Edit bookshelf item</Dialog.Title>
      <Dialog.Description>
        Update note or manual order for "{item?.title}".
      </Dialog.Description>
    </Dialog.Header>

    <form method="POST" use:enhance class="space-y-4">
      <Form.Field {form} name="note">
        <Form.Control>
          {#snippet children({ props })}
            <Form.Label>Note</Form.Label>
            <Textarea {...props} bind:value={$formData.note} />
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
            <Input {...props} type="number" step="1" bind:value={$formData.order} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors />
        <Form.Description>
          Optional manual position inside the bookshelf.
        </Form.Description>
      </Form.Field>

      <Dialog.Footer class="mt-6">
        <Button variant="outline" onclick={closeDialog} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

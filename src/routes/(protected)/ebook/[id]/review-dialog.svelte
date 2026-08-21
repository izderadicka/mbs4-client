<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Textarea } from "$lib/components/ui/textarea";
  import { toast } from "svelte-sonner";

  let {
    onSave,
  }: {
    onSave: (text: string | null) => Promise<void>;
  } = $props();

  let dialogOpen = $state(false);
  let text = $state("");
  let hadReview = $state(false);
  let submitting = $state(false);

  export function open(initialText: string | null) {
    text = initialText ?? "";
    hadReview = !!initialText;
    dialogOpen = true;
  }

  export function close() {
    dialogOpen = false;
  }

  async function save(value: string | null) {
    submitting = true;
    try {
      await onSave(value);
      dialogOpen = false;
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
      <Dialog.Title>My review</Dialog.Title>
      <Dialog.Description>
        Write a note about this ebook to keep with your rating.
      </Dialog.Description>
    </Dialog.Header>

    <Textarea bind:value={text} rows={6} aria-label="My review" />

    <Dialog.Footer class="mt-6">
      <Button variant="outline" onclick={close} disabled={submitting}
        >Cancel</Button>
      {#if hadReview}
        <Button
          variant="destructive"
          disabled={submitting}
          onclick={() => save(null)}>Remove review</Button>
      {/if}
      <Button disabled={submitting} onclick={() => save(text.trim() || null)}>
        {submitting ? "Saving..." : "Save"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

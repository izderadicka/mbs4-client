<script lang="ts">
  import type { EbookDoc, EbookSource } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import { Button } from "$lib/components/ui/button";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Label } from "$lib/components/ui/label";
  import EbookSearch from "./ebook-search.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";

  type Props = {
    currentEbookId: number;
    onMoved?: (sourceId: number) => void;
  };

  let { currentEbookId, onMoved }: Props = $props();

  let dialogOpen = $state(false);
  let source: EbookSource | null = $state(null);
  let selectedEbook: EbookDoc | null = $state(null);
  let followToTarget = $state(false);
  let submitting = $state(false);

  export function openDialog(s: EbookSource) {
    source = s;
    selectedEbook = null;
    followToTarget = false;
    submitting = false;
    dialogOpen = true;
  }

  function close() {
    dialogOpen = false;
  }

  function onEbookSelect(ebook: EbookDoc) {
    selectedEbook = ebook;
  }

  async function onConfirm() {
    if (!source || !selectedEbook) return;
    submitting = true;
    const sourceId = source.id;
    const targetId = selectedEbook.id;
    try {
      await apiClient.moveSource(sourceId, targetId);
      toast.success("Source moved");
      dialogOpen = false;
      if (followToTarget) {
        await goto(`/ebook/${targetId}`);
      } else {
        onMoved?.(sourceId);
      }
    } catch (error) {
      console.error("Failed to move source", error);
      toast.error("Failed to move source");
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Move source to another ebook</Dialog.Title>
      <Dialog.Description>
        {#if source}
          Search for the target ebook to move this {source.format_extension} source
          to.
        {:else}
          Search for the target ebook.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <EbookSearch onSelect={onEbookSelect} skip_ids={[currentEbookId]} />

      {#if selectedEbook}
        <div class="rounded border p-2 text-sm">
          <div class="font-medium">{selectedEbook.title}</div>
          <div class="text-muted-foreground">
            {selectedEbook.authors.map((a) => a.name).join(", ")}
            {#if selectedEbook.series}
              · {selectedEbook.series} #{selectedEbook.series_index}
            {/if}
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-2">
        <Checkbox id="follow-target" bind:checked={followToTarget} />
        <Label for="follow-target">Follow to target ebook</Label>
      </div>
    </div>

    <Dialog.Footer class="mt-6">
      <Button variant="outline" onclick={close} disabled={submitting}>
        Cancel
      </Button>
      <Button onclick={onConfirm} disabled={!selectedEbook || submitting}>
        {submitting ? "Moving..." : "Move"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

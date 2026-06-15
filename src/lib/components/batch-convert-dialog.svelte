<script lang="ts">
  import type { ConversionBatchEntity, FormatShort } from "$lib/api";
  import { apiClient } from "$lib/api/client";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
  import { toast } from "svelte-sonner";

  let {
    title,
    forEntity,
    entityId,
  }: {
    title: string;
    forEntity: ConversionBatchEntity;
    entityId: number;
  } = $props();

  let dialogOpen = $state(false);
  let formats = $state<FormatShort[]>([]);
  let selectedExtension = $state("");
  let submitting = $state(false);
  let loading = $state(false);

  const CONVERTIBLE_FORMATS = ["epub", "mobi", "txt", "pdf"];

  async function loadFormats() {
    loading = true;
    try {
      const all = await apiClient.listFormats();
      formats = all.filter((f) => CONVERTIBLE_FORMATS.includes(f.extension));
    } catch {
      toast.error("Failed to load formats");
    } finally {
      loading = false;
    }
  }

  export async function open() {
    selectedExtension = "";
    dialogOpen = true;
    await loadFormats();
  }

  export function close() {
    dialogOpen = false;
  }

  async function submit() {
    if (!selectedExtension) return;
    submitting = true;
    try {
      const ticket = await apiClient.startBatchConversion({
        for_entity: forEntity,
        entity_id: entityId,
        to_format_extension: selectedExtension,
      });
      const msg =
        ticket.dropped > 0
          ? `Batch conversion started (${ticket.total} ebooks, ${ticket.dropped} dropped)`
          : `Batch conversion started for ${ticket.total} ebooks`;
      toast.success(msg);
      dialogOpen = false;
    } catch {
      toast.error("Failed to start batch conversion");
    } finally {
      submitting = false;
    }
  }
</script>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Convert All to Format</Dialog.Title>
      <Dialog.Description>
        Start batch conversion of all ebooks in "{title}" to a target format.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-2">
      <div class="space-y-1">
        <label class="text-sm font-medium">Target Format</label>
        <Select.Root type="single" bind:value={selectedExtension}>
          <Select.Trigger class="w-full">
            {#if loading}
              Loading formats…
            {:else if selectedExtension}
              {formats.find((f) => f.extension === selectedExtension)?.name ?? selectedExtension}
            {:else}
              Select a format…
            {/if}
          </Select.Trigger>
          <Select.Content>
            {#each formats as fmt (fmt.id)}
              <Select.Item value={fmt.extension}>{fmt.name} (.{fmt.extension})</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    </div>

    <Dialog.Footer class="mt-4">
      <Button variant="outline" onclick={close} disabled={submitting}>Cancel</Button>
      <Button onclick={submit} disabled={submitting || !selectedExtension || loading}>
        {submitting ? "Starting…" : "Start Conversion"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

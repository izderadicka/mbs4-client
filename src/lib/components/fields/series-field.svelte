<script lang="ts">
  import type { Series, SeriesSearchItem, SeriesShort } from "$lib/api";
  import * as Form from "$lib/components/ui/form";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import ClearIcon from "@lucide/svelte/icons/x";
  import NewSeriesIcon from "@lucide/svelte/icons/package-plus";
  import { tick } from "svelte";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { buttonVariants } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import type { SuperForm } from "sveltekit-superforms";
  import SeriesForm from "../series-form.svelte";
  import { apiClient } from "$lib/api/client";
  import { toast } from "svelte-sonner";
  import SearchSupport from "./search-support.svelte";
  import CreateDialog from "$lib/components/fragments/create-dialog.svelte";

  let {
    form,
    value = $bindable(null),
    disableCreate = false,
    label = "Series",
    description = "Series title",
    omitSeriesId,
  }: {
    form: SuperForm<any>;
    value: { id: number; title: string } | null;
    disableCreate?: boolean;
    label?: string;
    description?: string;
    omitSeriesId?: number;
  } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement | null>(null);

  let series: SeriesShort[] = $state([]);

  const selectedValue = $derived(series.find((f) => f.id === value?.id)?.title);
  let filter = $state("");

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef?.focus();
    });
  }

  let dialog: CreateDialog;

  async function afterCreate(newSeries: Series) {
    dialog.close();
    value = { id: newSeries.id, title: newSeries.title };
    closeAndFocusTrigger();
  }

  function onCancel() {
    dialog.close();
    closeAndFocusTrigger();
  }

  async function search(query: string, limit: number, signal: AbortSignal) {
    const res = await apiClient.searchSeries(query, limit, signal);
    return res.filter((s) => s.doc.Series.id !== omitSeriesId);
  }

  async function onResult(res: SeriesSearchItem[] | null) {
    series = res ? res.map((item) => item.doc.Series) : [];
  }

  async function onError() {
    dialog.close();
  }
</script>

<SearchSupport {filter} {search} {onResult} />

<Form.Field {form} name="series">
  <Popover.Root bind:open>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>{label}</Form.Label>
        <Popover.Trigger
          {...props}
          bind:ref={triggerRef}
          type="button"
          class={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between",
          )}
          role="combobox"
          aria-expanded={open}>
          <span class="truncate">{value?.title || "Select a series..."}</span>
          <ChevronsUpDownIcon class="opacity-50" />
        </Popover.Trigger>
      {/snippet}
    </Form.Control>

    <Popover.Content class=" p-0" align="start">
      <Command.Root shouldFilter={false}>
        <Command.Input placeholder="Search series..." bind:value={filter} />

        <Command.Group value="series">
          <Command.List>
            <Command.Empty>No series found.</Command.Empty>
            {#each series as ser (ser.id)}
              <Command.Item
                value={`${ser.id}-${ser.title}`}
                onSelect={() => {
                  value = ser;
                  closeAndFocusTrigger();
                }}>
                <CheckIcon
                  class={cn(value?.id !== ser.id && "text-transparent")} />
                {ser.title}
              </Command.Item>
            {/each}
          </Command.List>
        </Command.Group>
        <Command.Separator forceMount={true} />
        <Command.Group value="commands">
          {#if filter && filter.length >= 3 && !disableCreate}
            <Command.Item
              value="__new_cmd__"
              onSelect={() => {
                dialog.open();
              }}>
              <NewSeriesIcon />
              Create new series</Command.Item>
          {/if}
          {#if value}
            <Command.Item
              onSelect={() => {
                value = null;
                closeAndFocusTrigger();
              }}
              value="__reset_cmd__">
              <ClearIcon />
              No series</Command.Item>
          {/if}
        </Command.Group>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
  <Form.FieldErrors />
  <Form.Description>{description}</Form.Description>
</Form.Field>

<CreateDialog bind:this={dialog} entityName="series">
  <SeriesForm
    seriesData={{ title: filter }}
    {afterCreate}
    {onCancel}
    {onError} />
</CreateDialog>

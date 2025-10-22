<script lang="ts" module>
  import type { SeriesShort } from "$lib/api";
  const SERIES: SeriesShort[] = [
    { id: 1, title: "Lord of the Rings" },
    { id: 2, title: "Hobbit" },
    { id: 3, title: "Silmarillion" },
    { id: 4, title: "Children of Hurin" },
    { id: 5, title: "Fellowship of the Ring" },
    { id: 6, title: "Two Towers" },
    { id: 7, title: "Return of the King" },
    {
      id: 8,
      title:
        "Extremely long series title that should be truncated maybe with ellipsis or something",
    },
  ];
</script>

<script lang="ts">
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
  import * as Dialog from "$lib/components/ui/dialog";
  import SeriesForm from "../series-form.svelte";
  import { apiClient } from "$lib/api/client";

  let {
    form,
    value = $bindable(null),
  }: { form: SuperForm<any>; value: { id: number; title: string } | null } =
    $props();

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

  const DEBOUNCE_MS = 600;
  const MIN_FILTER_LENGTH = 3;
  let debounceId: number | null = null;
  function onFilterInput(event: Event) {
    if (debounceId) {
      clearTimeout(debounceId);
      debounceId = null;
    }

    if (filter.length < MIN_FILTER_LENGTH) {
      return;
    }

    debounceId = window.setTimeout(() => runSearch(), DEBOUNCE_MS);
  }

  async function runSearch() {
    try {
      const res = await apiClient.searchSeries(filter, 10);
      series = res.map((s) => s.doc.Series);
    } catch (error) {
      console.error(error);
    }
  }

  let dialogOpen = $state(false);

  function openDialog() {
    dialogOpen = true;
  }

  function closeDialog() {
    dialogOpen = false;
  }

  function onCreate(series: SeriesShort) {
    closeDialog();
    value = { id: series.id, title: series.title };
    closeAndFocusTrigger();
  }
</script>

<Form.Field {form} name="series">
  <Popover.Root bind:open>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Series</Form.Label>
        <Popover.Trigger
          {...props}
          bind:ref={triggerRef}
          type="button"
          class={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between"
          )}
          role="combobox"
          aria-expanded={open}
        >
          <span class="truncate">{value?.title || "Select a series..."}</span>
          <ChevronsUpDownIcon class="opacity-50" />
        </Popover.Trigger>
      {/snippet}
    </Form.Control>

    <Popover.Content class=" p-0" align="start">
      <Command.Root shouldFilter={false}>
        <Command.Input
          placeholder="Search series..."
          bind:value={filter}
          oninput={onFilterInput}
        />
        <Command.List>
          <Command.Empty>No series found.</Command.Empty>
          <Command.Group value="commands">
            {#if value}
              <Command.Item
                onSelect={() => {
                  value = null;
                  closeAndFocusTrigger();
                }}
                value="__reset_cmd__"
              >
                <ClearIcon />
                No series</Command.Item
              >
            {/if}
            {#if filter}
              <Command.Item
                value="__new_cmd__"
                onSelect={() => {
                  openDialog();
                }}
              >
                <NewSeriesIcon />
                Create new series</Command.Item
              >
            {/if}
          </Command.Group>
          <Command.Separator forceMount={true} />
          <Command.Group value="series">
            {#each series as ser (ser.id)}
              <Command.Item
                value={`${ser.id}-${ser.title}`}
                onSelect={() => {
                  value = ser;
                  closeAndFocusTrigger();
                }}
              >
                <CheckIcon
                  class={cn(value?.id !== ser.id && "text-transparent")}
                />
                {ser.title}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
  <Form.FieldErrors />
  <Form.Description>Series title</Form.Description>
</Form.Field>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create new series</Dialog.Title>
      <Dialog.Description
        >Before creating a new series check that it doesn't already exist</Dialog.Description
      >
    </Dialog.Header>
    <SeriesForm seriesData={{ title: filter }} {onCreate} />
  </Dialog.Content>
</Dialog.Root>

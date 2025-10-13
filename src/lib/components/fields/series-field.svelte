<script lang="ts" module>
  const series = [
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
  import { tick } from "svelte";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";
  import type { SuperForm } from "sveltekit-superforms";

  let {
    form,
    value = $bindable(null),
  }: { form: SuperForm<any>; value: number | null } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement | null>(null);

  const selectedValue = $derived(series.find((f) => f.id === value)?.title);

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef?.focus();
    });
  }
</script>

<Form.Field {form} name="title">
  <Popover.Root bind:open>
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Series</Form.Label>
        <Popover.Trigger bind:ref={triggerRef}>
          <Button
            {...props}
            variant="outline"
            class="w-[200px] justify-between"
            role="combobox"
            aria-expanded={open}
          >
            {selectedValue || "Select a series..."}
            <ChevronsUpDownIcon class="opacity-50" />
          </Button>
        </Popover.Trigger>
      {/snippet}
    </Form.Control>

    <Popover.Content class="w-[200px] p-0">
      <Command.Root>
        <Command.Input placeholder="Search series..." />
        <Command.List>
          <Command.Empty>No series found.</Command.Empty>
          <Command.Group value="series">
            {#each series as ser (ser.id)}
              <Command.Item
                onSelect={() => {
                  value = ser.id;
                  closeAndFocusTrigger();
                }}
              >
                <CheckIcon class={cn(value !== ser.id && "text-transparent")} />
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

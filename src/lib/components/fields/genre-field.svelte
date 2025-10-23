<script lang="ts">
  import { type GenreShort } from "$lib/api";

  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import ClearButton from "$lib/components/fragments/clear-button.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import type { SuperForm } from "sveltekit-superforms";
  import { onMount } from "svelte";
  import { tick } from "svelte";
  import { apiClient } from "$lib/api/client";
  import Badge from "../ui/badge/badge.svelte";
  import { toast } from "svelte-sonner";

  let {
    value = $bindable(),
    form,
  }: { value: GenreShort[] | null; form: SuperForm<any> } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLElement | null>(null);
  let genres: GenreShort[] = $state([]);
  let freeGenres = $derived(genres.filter((g) => !isSelected(g.id)));

  onMount(async () => {
    try {
      genres = await apiClient.listGenres();
    } catch (error) {
      console.error("Failed to list genres", error);
      toast.error("Failed to list genres");
    }
  });

  function isSelected(gid: number): boolean {
    if (!value) return false;
    return value.findIndex(({ id }) => gid === id) >= 0;
  }

  function removeGenre(gid: number) {
    value = (value || []).filter((g) => g.id !== gid);
  }

  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef?.focus();
    });
  }
</script>

<Form.Field {form} name="genres">
  <Popover.Root bind:open>
    <Form.Control>
      <Form.Label>Genres</Form.Label>
      <Popover.Trigger bind:ref={triggerRef}>
        {#snippet child({ props })}
          <div
            {...props}
            class="
        w-full
        flex items-start gap-2
        rounded-md border border-input bg-background
        px-3 py-2
        text-sm
        min-h-10
        ring-offset-background
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        cursor-default
      "
            role="combobox"
            aria-expanded={open}
            tabindex="0"
          >
            <div class="flex flex-wrap items-center gap-1 flex-1 min-w-0">
              {#each value || [] as genre (genre.id)}
                <Badge variant="outline" class="ml-1"
                  ><span>{genre.name}</span>
                  <ClearButton
                    onActivation={() => removeGenre(genre.id)}
                  /></Badge
                >
              {/each}
            </div>
            <ChevronsUpDownIcon class="opacity-50 shrink-0 self-center" />
          </div>
        {/snippet}
      </Popover.Trigger>
    </Form.Control>
    <Popover.Content class="w-[200px] p-0" align="start">
      <Command.Root>
        <Command.Input placeholder="Search genre ..." />
        <Command.List>
          <Command.Empty>No genre found.</Command.Empty>
          <Command.Group value="frameworks">
            {#each freeGenres as genre (genre.id)}
              <Command.Item
                value={genre.name}
                onSelect={() => {
                  value = [...(value || []), genre];
                  closeAndFocusTrigger();
                }}
              >
                {genre.name}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>

  <Form.FieldErrors />
  <Form.Description>Genres of the ebook</Form.Description>
</Form.Field>

<script lang="ts">
  import {
    type AuthorSearchItem,
    type AuthorShort,
    type CreateAuthor,
  } from "$lib/api";

  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import ClearIcon from "@lucide/svelte/icons/x";
  import NewAuthorIcon from "@lucide/svelte/icons/user-plus";
  import ClearButton from "$lib/components/fragments/clear-button.svelte";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import type { SuperForm } from "sveltekit-superforms";
  import { tick } from "svelte";
  import { apiClient } from "$lib/api/client";
  import SearchSupport from "./search-support.svelte";
  import { toast } from "svelte-sonner";
  import CreateDialog from "$lib/components/fragments/create-dialog.svelte";
  import AuthorForm from "../author-form.svelte";

  let {
    value = $bindable(),
    form,
  }: { value: AuthorShort[] | null; form: SuperForm<any> } = $props();

  let open = $state(false);
  let triggerRef = $state<HTMLElement | null>(null);
  let authors: AuthorShort[] = $state([]);
  const freeAuthors = $derived(authors.filter((a) => !isSelected(a.id)));
  let filter = $state("");

  function isSelected(aid: number): boolean {
    return value?.some((a) => a.id === aid) ?? false;
  }

  function closeAndFocusTrigger() {
    open = false;
    tick().then(() => {
      triggerRef?.focus();
    });
  }

  async function search(query: string, limit: number, signal: AbortSignal) {
    return await apiClient.searchAuthor(query, limit, signal);
  }

  function onResult(res: AuthorSearchItem[] | null) {
    authors = res ? res.map((a) => a.doc.Author) : [];
  }

  function removeAuthor(aid: number) {
    if (!value) return;
    value = value.filter((a) => a.id !== aid);
  }

  let dialog: CreateDialog;

  function selectAuthor(author: AuthorShort) {
    value = [...(value || []), author];
    filter = "";
    authors = [];
  }

  async function onCreate(author: CreateAuthor) {
    dialog.close();
    try {
      const newAuthor = await apiClient.createAuthor(author);
      selectAuthor({
        id: newAuthor.id,
        last_name: newAuthor.last_name,
        first_name: newAuthor.first_name,
      });
    } catch (error) {
      console.error("Failed to create author", error);
      toast.error("Failed to create author");
    }

    closeAndFocusTrigger();
  }
</script>

<SearchSupport {filter} {search} {onResult} />

<Form.Field {form} name="authors">
  <Popover.Root bind:open>
    <Form.Control>
      <Form.Label>Authors</Form.Label>
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
              {#each value || [] as author (author.id)}
                <span
                  class="ml-1 inline-flex items-center gap-1 border-l border-gray-300 pl-2 first:border-none first:pl-0"
                >
                  <span class="ml-1"
                    ><span>{author.first_name} {author.last_name}</span>
                    <ClearButton
                      size="6"
                      onActivation={() => removeAuthor(author.id)}
                    /></span
                  >
                </span>
              {/each}
            </div>
            <ChevronsUpDownIcon class="opacity-50 shrink-0 self-center" />
          </div>
        {/snippet}
      </Popover.Trigger>
    </Form.Control>
    <Popover.Content class="w-[200px] p-0" align="start">
      <Command.Root shouldFilter={false}>
        <Command.Input placeholder="Search author ..." bind:value={filter} />

        <Command.Group value="authors">
          <Command.List>
            <Command.Empty>No author found.</Command.Empty>
            <Command.Group value="frameworks">
              {#each freeAuthors as author, i (author.id)}
                <Command.Item
                  value={String(author.id)}
                  onSelect={() => {
                    selectAuthor(author);
                    closeAndFocusTrigger();
                  }}
                >
                  {author.first_name}
                  {author.last_name}
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Group>
        <Command.Separator forceMount={true} />
        <Command.Group value="commands">
          {#if filter && filter.length >= 3}
            <Command.Item
              value="__new_cmd__"
              onSelect={() => {
                dialog.open();
              }}
            >
              <NewAuthorIcon />
              Create new author</Command.Item
            >
          {/if}
          {#if value && value.length > 0}
            <Command.Item
              onSelect={() => {
                value = null;
                closeAndFocusTrigger();
              }}
              value="__reset_cmd__"
            >
              <ClearIcon />
              No authors</Command.Item
            >
          {/if}
        </Command.Group>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
  <Form.FieldErrors />
  <Form.Description>Ebook authors</Form.Description>
</Form.Field>

<CreateDialog bind:this={dialog} entityName="author">
  <AuthorForm {onCreate} authorData={{ last_name: filter }} />
</CreateDialog>

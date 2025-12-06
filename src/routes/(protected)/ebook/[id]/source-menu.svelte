<script lang="ts" module>
  export type SourceMenuActions = "delete" | "convert";
  type SourceType = "source" | "conversion";
  const CONVERTIBLE_FORMATS = ["epub", "mobi", "txt", "pdf"];
</script>

<script lang="ts">
  import MenuIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { EbookConversion, EbookSource } from "$lib/api";
  import { hasRole } from "$lib/globals.svelte";
  type Props = {
    source: EbookSource | EbookConversion;
    onSourceMenuSelected?: (
      source: EbookSource,
      action: SourceMenuActions,
      data?: { format: string },
    ) => void;
    onConversionMenuSelected?: (
      source: EbookConversion,
      action: SourceMenuActions,
    ) => void;
  };

  let { source, onSourceMenuSelected, onConversionMenuSelected }: Props =
    $props();
  let sourceType: SourceType = $derived(
    "source_format_extension" in source ? "conversion" : "source",
  );
  function onMenuSelected(
    source: EbookSource | EbookConversion,
    action: SourceMenuActions,
    data?: { format: string },
  ) {
    if (sourceType === "source" && onSourceMenuSelected) {
      onSourceMenuSelected(source as EbookSource, action, data);
    } else if (sourceType === "conversion" && onConversionMenuSelected) {
      onConversionMenuSelected(source as EbookConversion, action);
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost">
        <MenuIcon class="" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.Group>
      <DropdownMenu.Label>Ebook File Actions</DropdownMenu.Label>
      <DropdownMenu.Separator />
      {#if (sourceType === "conversion" && hasRole("Trusted")) || hasRole("Admin")}
        <DropdownMenu.Item onSelect={() => onMenuSelected(source, "delete")}
          >Delete File</DropdownMenu.Item>
      {/if}
      {#if sourceType === "source" && hasRole("Trusted")}
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Convert to ...</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            {#each CONVERTIBLE_FORMATS.filter((f) => f !== source.format_extension) as format}
              <DropdownMenu.Item
                onSelect={() => onMenuSelected(source, "convert", { format })}
                >{format}</DropdownMenu.Item>
            {/each}
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      {/if}
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

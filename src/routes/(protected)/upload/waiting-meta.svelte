<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Item from "$lib/components/ui/item";
  import { Spinner } from "$lib/components/ui/spinner";
  import { WAIT_LONG_FOR_META_TIMEOUT } from "$lib/config";
  import { onDestroy, onMount } from "svelte";

  let { onRestart }: { onRestart: () => void } = $props();

  let timerId: number | null = null;
  let waitingLong = $state(false);
  onMount(() => {
    timerId = setTimeout(() => {
      waitingLong = true;
    }, WAIT_LONG_FOR_META_TIMEOUT);
  });
  onDestroy(() => {
    timerId && clearTimeout(timerId);
    timerId = null;
  });
</script>

<Item.Root variant="muted">
  <Item.Media>
    <Spinner />
  </Item.Media>
  <Item.Content>
    <Item.Title class="line-clamp-1"
      >Waiting {waitingLong ? "too long" : ""}for metadata ...</Item.Title
    >
  </Item.Content>
  {#if waitingLong}
    <Item.Content class="flex-none justify-end">
      <Button variant="secondary" onclick={onRestart}>Restart</Button>
    </Item.Content>
  {/if}
</Item.Root>

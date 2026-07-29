<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Select from "$lib/components/ui/select";
  import Spinner from "$lib/components/ui/spinner/spinner.svelte";
  import PlayIcon from "@lucide/svelte/icons/play";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import SquareIcon from "@lucide/svelte/icons/square";
  import SkipBackIcon from "@lucide/svelte/icons/skip-back";
  import SkipForwardIcon from "@lucide/svelte/icons/skip-forward";
  import XIcon from "@lucide/svelte/icons/x";
  import type { TtsController } from "$lib/reader/tts/controller.svelte";
  import { TTS_RATES, type TtsRate } from "$lib/reader/tts/tts-prefs.svelte";

  // onClose ends read-aloud mode and hides this bar
  let {
    controller,
    onClose,
  }: { controller: TtsController; onClose: () => void } = $props();

  // While buffering, every control except Stop is locked: they would only
  // restart or re-queue synthesis that has not produced audio yet. Stop
  // cancels the wait (important for Piper, whose voices take notable time to
  // download and initialize); Close leaves read-aloud altogether and stays
  // available too, so the user is never stuck in the bar.
  let buffering = $derived(controller.status === "buffering");
  let playing = $derived(controller.status === "playing" || buffering);
  let locked = $derived(controller.status === "off" || buffering);
  let rateStr = $derived(`${controller.rate}×`);
  let voiceName = $derived(
    controller.voices.find((v) => v.id === controller.voice)?.name ?? "Voice",
  );
</script>

<div
  class="relative flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-t px-2 max-[520px]:py-1">
  <div class="flex items-center gap-2 max-[520px]:mx-auto">
    <Button
      variant="ghost"
      size="icon"
      title="Previous sentence"
      disabled={locked}
      onclick={() => controller.prevSentence()}><SkipBackIcon /></Button>
    {#if playing}
      <Button
        variant="ghost"
        size="icon"
        title="Pause"
        disabled={buffering}
        onclick={() => controller.pause()}><PauseIcon /></Button>
    {:else}
      <Button
        variant="ghost"
        size="icon"
        title="Play"
        disabled={locked}
        onclick={() => controller.play()}><PlayIcon /></Button>
    {/if}
    <Button
      variant="ghost"
      size="icon"
      title="Stop reading"
      disabled={controller.status === "idle" || controller.status === "off"}
      onclick={() => controller.stop()}><SquareIcon /></Button>
    <Button
      variant="ghost"
      size="icon"
      title="Next sentence"
      disabled={locked}
      onclick={() => controller.nextSentence()}><SkipForwardIcon /></Button>
  </div>

  {#if controller.status === "buffering"}
    <Spinner
      class="hidden size-4 max-[520px]:absolute max-[520px]:right-2 max-[520px]:top-3.5 max-[520px]:block" />
  {/if}

  {#if controller.status === "buffering" || controller.status === "error" || controller.status === "ended"}
    <div
      class="min-w-0 flex-1 text-center {controller.status === 'buffering'
        ? 'max-[520px]:hidden'
        : 'max-[520px]:w-full'}">
      {#if controller.status === "buffering"}
        <span
          class="text-muted-foreground inline-flex items-center gap-1 text-xs">
          <Spinner class="size-3" /> Buffering…
        </span>
      {:else if controller.status === "error"}
        <span
          class="text-destructive truncate text-xs"
          title={controller.errorMessage}>
          {controller.errorMessage}
        </span>
      {:else}
        <span class="text-muted-foreground text-xs">End of book</span>
      {/if}
    </div>
  {/if}

  <div class="ms-auto flex items-center gap-2 max-[520px]:w-full">
    <Select.Root
      type="single"
      value={controller.voice ?? ""}
      onValueChange={(v) => v && controller.setVoice(v)}>
      <Select.Trigger
        class="w-36 max-[520px]:w-auto max-[520px]:flex-1"
        title="Voice"
        disabled={controller.voices.length === 0 || buffering}
        ><span class="truncate">{voiceName}</span></Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each controller.voices as v (v.id)}
            <Select.Item value={v.id}
              >{v.name}{v.lang ? ` (${v.lang})` : ""}</Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>

    <Select.Root
      type="single"
      value={String(controller.rate)}
      onValueChange={(v) => controller.setRate(Number(v) as TtsRate)}>
      <Select.Trigger class="w-20" title="Speech rate" disabled={buffering}
        >{rateStr}</Select.Trigger>
      <Select.Content>
        <Select.Group>
          {#each TTS_RATES as r (r)}
            <Select.Item value={String(r)}>{r}&times;</Select.Item>
          {/each}
        </Select.Group>
      </Select.Content>
    </Select.Root>

    <Button
      variant="ghost"
      size="icon"
      title="Close read aloud"
      onclick={onClose}><XIcon /></Button>
  </div>
</div>

<script lang="ts">
  import Button from "../ui/button/button.svelte";
  import ClearIcon from "@lucide/svelte/icons/x";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = {
    onActivation: () => any;
    size: string;
  } & HTMLButtonAttributes;
  let { onActivation, size = "4", ...restProps } = $props();
</script>

<Button
  {...restProps}
  variant="ghost"
  class="size-{size} cursor-pointer align-middle"
  onclick={(e) => {
    e.stopPropagation();
    onActivation();
  }}
  onpointerdown={(e) => e.stopPropagation()}
  onkeydown={(e) => {
    e.stopPropagation();
    if (e.key === "Enter") onActivation;
  }}><ClearIcon /></Button>

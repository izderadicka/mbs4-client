<script lang="ts">
  import type { Snippet } from "svelte";
  import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
  import * as Alert from "$lib/components/ui/alert";
  let { children, title }: { children: Snippet; title: string } = $props();
</script>

<div class="mb-4">
  <Alert.Root variant="destructive">
    <AlertCircleIcon />
    <Alert.Title>{title}</Alert.Title>
    <Alert.Description>
      {@render children()}
    </Alert.Description>
  </Alert.Root>
</div>

<script lang="ts">
  import "../app.css";

  import { ModeWatcher } from "mode-watcher";

  import type { User } from "$lib/types/app";
  import { appUser } from "$lib/globals.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  const { children, data } = $props();
  const { user }: { user: User | null } = data;
  if (user) {
    appUser.user = user;
  } else {
    appUser.user = null;
    localStorage.removeItem("user");
  }

  onMount(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("trt")) {
      url.searchParams.delete("trt");
      goto(url.pathname + url.search, { replaceState: true, noScroll: true });
    }
  });
</script>

<ModeWatcher />
{@render children()}

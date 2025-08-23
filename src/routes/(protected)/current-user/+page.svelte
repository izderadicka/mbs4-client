<script lang="ts">
  import { appUser } from "$lib/globals.svelte";
</script>

<h1>Your details</h1>

<pre>{JSON.stringify(appUser.user, null, 2)}</pre>

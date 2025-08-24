<script lang="ts">
  import { appUser, breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";

  breadcrumb.path = [{ name: "Upload Ebook", path: "/upload" }];
</script>

<Title>Your details</Title>

<pre>{JSON.stringify(appUser.user, null, 2)}</pre>

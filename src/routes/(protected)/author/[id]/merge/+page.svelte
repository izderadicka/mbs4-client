<script lang="ts">
  import { breadcrumb } from "$lib/globals.svelte";
  import Title from "$lib/components/title.svelte";

  breadcrumb.path = [{ name: "Authors", path: "/author" }];
</script>

<Title>Merge Author</Title>

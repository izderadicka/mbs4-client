<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Series } from "$lib/api";
  import SeriesForm from "$lib/components/series-form.svelte";
  import Title from "$lib/components/title.svelte";

  async function onCancel() {
    await goto("/series");
  }

  async function afterCreate(series: Series) {
    await goto("/series/" + series.id);
  }
</script>

<Title>New Series</Title>
<p class="italic text-muted-foreground">
  But better way is to create new author during ebook file upload
</p>

<SeriesForm {onCancel} {afterCreate} />

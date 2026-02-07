<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Series } from "$lib/api";
  import SeriesForm from "$lib/components/series-form.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";

  let { data } = $props();
  let series = $derived(data.series);
  let hasBooks = $derived(data.hasBooks);

  breadcrumb.path = [
    { name: "Series", path: "/series" },
    // svelte-ignore state_referenced_locally
    { name: series.title, path: "/series/" + series.id },
    { name: "Edit" },
  ];

  async function onCancel() {
    await goto("/series/" + series.id);
  }

  async function afterUpdate(series: Series) {
    await goto("/series/" + series.id);
  }

  async function afterDelete(id: number) {
    await goto("/series");
  }
</script>

<Title>Edit Series</Title>
<SeriesForm
  seriesData={series}
  {hasBooks}
  {onCancel}
  {afterUpdate}
  {afterDelete} />

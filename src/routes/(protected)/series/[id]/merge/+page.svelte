<script lang="ts">
  import { goto } from "$app/navigation";
  import type { Series, SeriesShort } from "$lib/api";
  import { apiClient } from "$lib/api/client.js";
  import SeriesField from "$lib/components/fields/series-field.svelte";
  import MergeButtons from "$lib/components/fragments/merge-buttons.svelte";
  import MergeDirectionRadio from "$lib/components/fragments/merge-direction-radio.svelte";
  import Title from "$lib/components/title.svelte";
  import { breadcrumb } from "$lib/globals.svelte.js";
  import type { MergeDirection } from "$lib/types/app.js";
  import { toast } from "svelte-sonner";
  import { superForm } from "sveltekit-superforms";

  let { data } = $props();
  let series = $derived(data.series);

  breadcrumb.path = [
    { name: "Series", path: "/series" },
    // svelte-ignore state_referenced_locally
    { name: series.title, path: "/series/" + series.id },
    { name: "Merge" },
  ];

  let otherSeries = $state<SeriesShort | null>(null);
  let otherSeriesBooks = $derived(fetchSeriesBooks(otherSeries?.id));
  let mergeDirection: MergeDirection = $state("from");
  let inputData = { series: null };
  const form = superForm(inputData, {
    SPA: true,
    dataType: "json",
    validators: false,
    onChange: async () => {
      if ($formData.series) {
        otherSeries = $formData.series;
      } else {
        otherSeries = null;
      }
    },
  });
  const { form: formData } = form;

  async function fetchSeriesBooks(id: number | undefined) {
    if (id == null) {
      return null;
    }
    return await apiClient.listSeriesEbooks(id, { page_size: 3 });
  }

  async function onMerge() {
    let finalId = null;
    try {
      if (mergeDirection === "to") {
        await apiClient.mergeSeries(series.id, otherSeries!.id);
        finalId = otherSeries!.id;
      } else {
        await apiClient.mergeSeries(otherSeries!.id, series.id);
        finalId = series.id;
      }
    } catch (error) {
      console.error("Failed to merge series", error);
      toast.error("Failed to merge series");
      return;
    }
    if (finalId) await goto(`/series/${finalId}`);
  }

  async function onCancel() {
    await goto("/series/" + series.id);
  }
</script>

<Title>Merge Series: {series.title}</Title>

<SeriesField
  {form}
  bind:value={$formData.series}
  label="Other Series"
  description="Choose Series to merge with"
  disableCreate={true}
  omitSeriesId={series.id} />

<MergeDirectionRadio bind:mergeDirection entityName="Series" />

{#if otherSeries}
  <Title>Other Series: {otherSeries.title}</Title>
  {#await otherSeriesBooks then books}
    {#if books}
      <p>
        Series(id: {otherSeries.id}) has {books.total} books, like {books.rows
          .map((b) => b.title)
          .join(", ")}
      </p>
    {/if}
  {/await}
{/if}

<MergeButtons
  {onCancel}
  {onMerge}
  {mergeDirection}
  disabled={otherSeries === null} />

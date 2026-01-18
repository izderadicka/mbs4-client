<script lang="ts" module>
  import type { LibraryStats } from "$lib/api";
  type StatKeys = keyof LibraryStats;

  const LABELS = [
    {
      key: "totalEbooks" as StatKeys,
      label: "Total Ebooks",
      path: "/ebook",
    },
    {
      key: "totalSeries" as StatKeys,
      label: "Total Series",
      path: "/series",
    },
    {
      key: "totalAuthors" as StatKeys,
      label: "Total Authors",
      path: "/author",
    },
  ];
</script>

<script lang="ts">
  import { apiClient } from "$lib/api/client";
  import { onMount } from "svelte";
  import Subtitle from "$lib/components/subtitle.svelte";

  let stats: LibraryStats | null = $state(null);
  onMount(async () => {
    try {
      stats = await apiClient.getLibraryStats();
    } catch (error) {
      console.error("Failed to fetch library stats", error);
    }
  });
</script>

<Subtitle>Library Statistics</Subtitle>
{#if stats}
  <div
    class="
    flex flex-col gap-4
    sm:flex-row sm:justify-between
    rounded-xl border bg-card p-6
  ">
    {#each LABELS as { key, label, path }}
      <div class="flex flex-col sm:items-center">
        <div class="text-sm text-muted-foreground">
          {label}
        </div>

        <div class="text-3xl font-semibold tabular-nums">
          <a href={path}>{stats[key]}</a>
        </div>
      </div>
    {/each}
  </div>
{/if}

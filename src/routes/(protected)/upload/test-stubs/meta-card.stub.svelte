<script lang="ts">
  const {
    metadata,
  }: {
    metadata: { title: string };
  } = $props();
</script>

<div>Metadata: {metadata.title}</div>

<script lang="ts">
  const {
    onChosen,
    onNew,
  }: {
    metadata: unknown;
    onChosen: (ebook: { id: number; title: string }) => void;
    onNew: () => void;
  } = $props();
</script>

<button type="button" onclick={() => onChosen({ id: 42, title: "Existing Ebook" })}>
  Choose Existing
</button>
<button type="button" onclick={onNew}>Create New Path</button>

<script lang="ts">
  const {
    afterCreate,
    onCancel,
  }: {
    ebookData: unknown;
    afterCreate: (ebook: { id: number; title: string }) => Promise<void>;
    onCancel: () => void;
  } = $props();
</script>

<button type="button" onclick={() => afterCreate({ id: 55, title: "Created Ebook" })}>
  Finish Create
</button>
<button type="button" onclick={onCancel}>Cancel Create</button>

<script lang="ts">
  const {
    onUpload,
    onError,
  }: {
    onUpload: (payload: {
      uploadInfo: {
        final_path: string;
        size: number;
        hash: string;
      };
      metaTicket: { id: number };
    }) => void;
    onError: (error: string) => void;
  } = $props();

  export function reset() {}
</script>

<button
  type="button"
  onclick={() =>
    onUpload({
      uploadInfo: {
        final_path: "uploads/book.epub",
        size: 123,
        hash: "abc123",
      },
      metaTicket: { id: 77 },
    })}
>
  Trigger Upload
</button>
<button type="button" onclick={() => onError("Upload failed")}>Trigger Upload Error</button>

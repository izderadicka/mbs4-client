<script lang="ts">
  type Props = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: () => void;
  };

  let { value = "", onValueChange, children }: Props = $props();
</script>

<input
  aria-label="Bookshelf"
  value={value}
  oninput={(e) => onValueChange?.((e.currentTarget as HTMLInputElement).value)}
/>
{@render children?.()}

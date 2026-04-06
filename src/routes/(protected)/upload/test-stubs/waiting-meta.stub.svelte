<script lang="ts">
  let { onRestart }: { onRestart: () => void } = $props();
</script>

<div>Waiting Stub</div>
<button type="button" onclick={onRestart}>Restart</button>

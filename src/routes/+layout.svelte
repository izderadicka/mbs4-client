<script lang="ts">
  import "../app.css";
  import "../app.scss";
  
  const { children } = $props();
</script>

<nav>Navigation Bar</nav>

{@render children()}

<style lang="scss">
</style>

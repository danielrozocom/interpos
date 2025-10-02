<script lang="ts">
  // Minimal layout for login page: don't render the global sidebar/topbar
  export let data: any;
</script>

<style>
  main { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f8fafc; }
</style>

<main>
  <slot />
</main>

<script lang="ts">
  // Minimal layout for login page: don't render the global sidebar/topbar
  // `data` is not used in this layout; declare as const to avoid Svelte "unused export" warning
  export const data: any = undefined;
</script>

<style>
  main { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f8fafc; }
</style>

<main>
  <slot />
</main>

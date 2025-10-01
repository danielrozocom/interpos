<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  let el: HTMLDivElement;

  onMount(() => {
    if (!el) return;
    try { document.body.appendChild(el); } catch (_) {}
  });

  onDestroy(() => {
    try { el?.remove(); } catch(_) {}
  });
</script>

<div bind:this={el}>
  <slot />
</div>

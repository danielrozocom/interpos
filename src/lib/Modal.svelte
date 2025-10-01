<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  export let open: boolean = false;
  export let title: string = '';
  export let closeOnBackdrop: boolean = true;
  export let trapFocus: boolean = true;

  const dispatch = createEventDispatcher();
  let _bodyScrollY = 0;
  let dialogEl: HTMLElement | null = null;

  // when `open` changes from outside, run handlers
  $: if (open) handleOpen();

  function saveScrollAndLock() {
    if (typeof window === 'undefined') return;
    _bodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    // apply fixed positioning to preserve visual position
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_bodyScrollY}px`;
    document.body.style.width = '100%';
    try { document.documentElement.classList.add('modal-open'); document.body.classList.add('modal-open'); } catch(e) {}
  }

  function restoreScrollAndUnlock() {
    if (typeof window === 'undefined') return;
    try { document.documentElement.classList.remove('modal-open'); document.body.classList.remove('modal-open'); } catch(e) {}
    // restore body
    const y = _bodyScrollY || 0;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    try { window.scrollTo(0, y); } catch(e) {}
  }

  async function handleOpen() {
    await tick();
    saveScrollAndLock();
    // focus dialog for accessibility
    try {
      dialogEl?.focus({ preventScroll: true } as any);
    } catch(e) {
      try { dialogEl?.focus(); } catch(_) {}
    }
  }

  function close(reason: string = 'backdrop') {
    open = false;
    restoreScrollAndUnlock();
    dispatch('close', { reason });
  }

  function onBackdropClick() {
    if (closeOnBackdrop) close('backdrop');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close('escape');
    }
  }

  onDestroy(() => {
    // ensure body styles removed
    restoreScrollAndUnlock();
  });
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" on:keydown={onKeydown}>
    <div class="fixed inset-0 bg-black/40" on:click={onBackdropClick} aria-hidden="true"></div>
    <div bind:this={dialogEl} tabindex="-1" class="relative w-full {"max-w-3xl"} bg-white rounded-lg shadow-lg modal-content" role="dialog" aria-modal="true" aria-label={title}>
      <div class="p-6 flex flex-col">
        <div class="flex items-start justify-between mb-4">
          {#if title}
            <h3 class="text-lg font-semibold text-gray-900">{title}</h3>
          {/if}
          <button aria-label="Cerrar" class="ml-4 text-gray-500" on:click={() => close('close-button')}>
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="overflow-auto" style="max-height: calc(80vh - 120px);">
          <slot />
        </div>

        <div class="mt-4">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-content { border-radius: var(--radius-lg); }
</style>

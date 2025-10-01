<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from 'svelte';
  import Portal from './Portal.svelte';
  export let open: boolean = false;
  export let title: string = '';
  export let closeOnBackdrop: boolean = true;
  export let trapFocus: boolean = true;
  // When true the modal shows a blocking busy spinner and prevents closing
  export let busy: boolean = false;
  // per-instance z offset to allow stacked modals (confirmations) to appear above
  export let zOffset: number = 0;

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
    if (closeOnBackdrop && !busy) close('backdrop');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (!busy) close('escape');
    }
  }

  onDestroy(() => {
    // ensure body styles removed
    restoreScrollAndUnlock();
  });
</script>

{#if open}
  {@const BASE_Z = 9999}
  {@const portalZ = BASE_Z + (zOffset || 0)}
  {@const backdropZ = BASE_Z + (zOffset || 0)}
  {@const dialogZ = BASE_Z + (zOffset || 0) + 10}

  <Portal>
    <div class="fixed inset-0 modal-portal flex items-center justify-center p-4" on:keydown={onKeydown} role="presentation" style={`z-index: ${portalZ}`}>
      <div class="fixed inset-0 modal-backdrop" on:click={onBackdropClick} aria-hidden="true" style={`z-index: ${backdropZ}`}></div>
      <div bind:this={dialogEl} tabindex="-1" class="relative w-full max-w-3xl bg-white rounded-lg shadow-lg modal-content" role="dialog" aria-modal="true" aria-label={title} style={`z-index: ${dialogZ}`}>
      {#if busy}
        <!-- blocking overlay inside the modal to show centralized spinner while saving -->
        <div class="absolute inset-0 z-50 flex items-center justify-center" style="background: rgba(255,255,255,0.7);">
          <div class="flex flex-col items-center gap-3">
            <svg class="h-8 w-8 animate-spin text-[#35528C]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <div class="text-sm text-[#35528C] font-medium">Guardando...</div>
          </div>
        </div>
      {/if}
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
  </Portal>
{/if}

<style>
  /* z-index variables: keep modals on top of everything else in the app */
  :root {
    --modal-z-base: 9999;
    --modal-backdrop-z: calc(var(--modal-z-base) + 0);
    --modal-dialog-z: calc(var(--modal-z-base) + 10);
  }

  .modal-portal { z-index: var(--modal-z-base); position: fixed; inset: 0; }
  .modal-backdrop { z-index: var(--modal-backdrop-z); background: rgba(0,0,0,0.4); }
  .modal-content { border-radius: var(--radius-lg); z-index: var(--modal-dialog-z); }
</style>

<script lang="ts">
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  let menuOpen = false;
  import { page } from '$app/stores';

  // Global Ctrl-based shortcuts dispatcher
  function globalKeyHandler(e: KeyboardEvent) {
    if (typeof window === 'undefined') return;
    if (!(e.ctrlKey || (navigator.platform && /Mac/.test(navigator.platform) && e.metaKey))) return;

    const active = typeof document !== 'undefined' ? document.activeElement as HTMLElement | null : null;
    const tag = active?.tagName?.toLowerCase();
    const isInputLike = tag === 'input' || tag === 'textarea' || active?.isContentEditable;

    // Don't interfere with common edit shortcuts inside inputs (Ctrl+A/C/V/X/Z/Y)
    // But allow some global actions to work while typing: Enter (submit), K (open scanner), L (focus id), Backspace (clear id)
    const keyLower = e.key.toLowerCase();
    const editShortcuts = ['a', 'c', 'v', 'x', 'z', 'y'];
    const allowedWhileInput = ['enter', 'k', 'l', 'backspace'];
    if (isInputLike && !editShortcuts.includes(keyLower) && !allowedWhileInput.includes(keyLower === 'enter' ? 'enter' : keyLower)) {
      return;
    }

    // Map keys to high-level actions and broadcast them so pages can react
    if (e.key === 'Enter') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'submit' } }));
      return;
    }
    if (e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'openScanner' } }));
      return;
    }
    if (e.key.toLowerCase() === 'l') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'focusId' } }));
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('global-shortcut', { detail: { action: 'clearId' } }));
      return;
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') window.addEventListener('keydown', globalKeyHandler);
  });
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', globalKeyHandler);
  });
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-[#35528C] shadow-sm border-b relative">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-white">InterPOS</h1>
        </div>
        <!-- Desktop menu -->
        <div class="hidden md:flex items-center space-x-4">
          <a href="/" class="px-3 py-3 rounded-md text-base font-semibold text-white uppercase hover:bg-[#27406B] border-b-2 transition-all duration-150 { $page.url.pathname === '/' ? 'border-white' : 'border-transparent' }">INICIO</a>
          <a href="/recharge" class="px-3 py-3 rounded-md text-base font-semibold text-white uppercase hover:bg-[#27406B] border-b-2 transition-all duration-150 { $page.url.pathname === '/recharge' ? 'border-white' : 'border-transparent' }">RECARGAR</a>
          <a href="/history" class="px-3 py-3 rounded-md text-base font-semibold text-white uppercase hover:bg-[#27406B] border-b-2 transition-all duration-150 { $page.url.pathname === '/history' ? 'border-white' : 'border-transparent' }">HISTORIAL</a>
          <a href="/check-balance" class="px-3 py-3 rounded-md text-base font-semibold text-white uppercase hover:bg-[#27406B] border-b-2 transition-all duration-150 { $page.url.pathname === '/check-balance' ? 'border-white' : 'border-transparent' }">CONSULTAR SALDO</a>
          <a href="/sell" class="px-3 py-3 rounded-md text-base font-semibold text-white uppercase hover:bg-[#27406B] border-b-2 transition-all duration-150 { $page.url.pathname === '/sell' ? 'border-white' : 'border-transparent' }">VENDER</a>
        </div>
        <!-- Mobile hamburger -->
        <div class="md:hidden flex items-center">
          <button aria-label="Abrir menú" on:click={() => menuOpen = !menuOpen} class="inline-flex items-center justify-center p-2 rounded-md text-white hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
            <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path class={menuOpen ? 'hidden' : 'block'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path class={menuOpen ? 'block' : 'hidden'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    <!-- Mobile menu - positioned absolutely outside the container -->
    {#if menuOpen}
      <div class="md:hidden bg-[#35528C] border-t border-[#27406B] absolute top-full left-0 right-0 z-50 shadow-lg">
        <div class="px-4 py-2 space-y-1">
          <a href="/" class="block text-white px-4 py-3 text-base font-semibold uppercase hover:bg-[#27406B] rounded transition-colors duration-150 { $page.url.pathname === '/' ? 'bg-[#27406B]' : '' }" on:click={() => menuOpen = false}>INICIO</a>
          <a href="/recharge" class="block text-white px-4 py-3 text-base font-semibold uppercase hover:bg-[#27406B] rounded transition-colors duration-150 { $page.url.pathname === '/recharge' ? 'bg-[#27406B]' : '' }" on:click={() => menuOpen = false}>RECARGAR</a>
          <a href="/history" class="block text-white px-4 py-3 text-base font-semibold uppercase hover:bg-[#27406B] rounded transition-colors duration-150 { $page.url.pathname === '/history' ? 'bg-[#27406B]' : '' }" on:click={() => menuOpen = false}>HISTORIAL</a>
          <a href="/check-balance" class="block text-white px-4 py-3 text-base font-semibold uppercase hover:bg-[#27406B] rounded transition-colors duration-150 { $page.url.pathname === '/check-balance' ? 'bg-[#27406B]' : '' }" on:click={() => menuOpen = false}>CONSULTAR SALDO</a>
          <a href="/sell" class="block text-white px-4 py-3 text-base font-semibold uppercase hover:bg-[#27406B] rounded transition-colors duration-150 { $page.url.pathname === '/sell' ? 'bg-[#27406B]' : '' }" on:click={() => menuOpen = false}>VENDER</a>
        </div>
      </div>
    {/if}
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
</div>

<script lang="ts">
  import '../app.css';
  let menuOpen = false;
  import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-[#35528C] shadow-sm border-b">
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
      <!-- Mobile menu -->
      {#if menuOpen}
        <div class="md:hidden bg-[#35528C] border-b shadow-sm rounded-b-lg mt-2">
          <a href="/" class="block text-white px-4 py-3 text-lg font-semibold uppercase border-b-2 transition-all duration-150 { $page.url.pathname === '/' ? 'border-white' : 'border-transparent' }" on:click={() => menuOpen = false}>INICIO</a>
          <a href="/recharge" class="block text-white px-4 py-3 text-lg font-semibold uppercase border-b-2 transition-all duration-150 { $page.url.pathname === '/recharge' ? 'border-white' : 'border-transparent' }" on:click={() => menuOpen = false}>RECARGAR</a>
          <a href="/history" class="block text-white px-4 py-3 text-lg font-semibold uppercase border-b-2 transition-all duration-150 { $page.url.pathname === '/history' ? 'border-white' : 'border-transparent' }" on:click={() => menuOpen = false}>HISTORIAL</a>
          <a href="/check-balance" class="block text-white px-4 py-3 text-lg font-semibold uppercase border-b-2 transition-all duration-150 { $page.url.pathname === '/check-balance' ? 'border-white' : 'border-transparent' }" on:click={() => menuOpen = false}>CONSULTAR SALDO</a>
          <a href="/sell" class="block text-white px-4 py-3 text-lg font-semibold uppercase border-b-2 transition-all duration-150 { $page.url.pathname === '/sell' ? 'border-white' : 'border-transparent' }" on:click={() => menuOpen = false}>VENDER</a>
        </div>
      {/if}
      </div> <!-- Explicitly close the inner div before nav ends -->
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
</div>

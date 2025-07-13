<script lang="ts">
  import '../app.css';
  let menuOpen = false;
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-gray-900">InterPOS</h1>
        </div>
        <!-- Desktop menu -->
        <div class="hidden md:flex items-center space-x-4">
          <a href="/" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Inicio</a>
          <a href="/recharge" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Recargar</a>
          <a href="/history" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Historial</a>
          <a href="/check-balance" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Consultar Saldo</a>
        </div>
        <!-- Mobile hamburger -->
        <div class="md:hidden flex items-center">
          <button on:click={() => menuOpen = !menuOpen} class="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#35528C]">
            <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path class={menuOpen ? 'hidden' : 'block'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              <path class={menuOpen ? 'block' : 'hidden'} stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <!-- Mobile menu -->
      {#if menuOpen}
        <div class="md:hidden bg-white border-b shadow-sm rounded-b-lg mt-2">
          <a href="/" class="block text-gray-600 hover:text-gray-900 px-4 py-2 text-base font-medium">Inicio</a>
          <a href="/recharge" class="block text-gray-600 hover:text-gray-900 px-4 py-2 text-base font-medium">Recargar</a>
          <a href="/history" class="block text-gray-600 hover:text-gray-900 px-4 py-2 text-base font-medium">Historial</a>
          <a href="/check-balance" class="block text-gray-600 hover:text-gray-900 px-4 py-2 text-base font-medium">Consultar Saldo</a>
        </div>
      {/if}
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
</div>

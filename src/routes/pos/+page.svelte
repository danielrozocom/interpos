<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Stores
  const selectedCategory = writable<string | null>(null);
  const selectedProduct = writable<any>(null);
  const quantity = writable(1);
  const userBalance = writable(0);

  let categories: string[] = [];
  let products: Record<string, any[]> = {};
  let loading = false;
  let error = '';
  let userId = '123'; // TODO: Replace with actual user ID

  // Derived stores for calculations
  $: subtotal = $selectedProduct ? $selectedProduct.price * $quantity : 0;
  $: canPay = $userBalance >= subtotal && subtotal > 0;

  // Load categories and products
  async function loadProducts() {
    try {
      const response = await fetch('/api/sheets/products');
      const data = await response.json();
      if (data.success) {
        // Group products by category
        const productsByCategory = data.products.reduce((acc: Record<string, any[]>, product: any) => {
          if (!acc[product.category]) {
            acc[product.category] = [];
          }
          acc[product.category].push(product);
          return acc;
        }, {});
        categories = Object.keys(productsByCategory);
        products = productsByCategory;
      }
    } catch (err) {
      error = 'Error al cargar los productos';
    }
  }

  // Load user balance
  async function loadUserBalance() {
    try {
      const response = await fetch(`/api/sheets/users/balance?userId=${userId}`);
      const data = await response.json();
      if (data.success) {
        userBalance.set(data.balance);
      }
    } catch (err) {
      error = 'Error al cargar el saldo';
    }
  }

  // Handle payment
  async function handlePayment() {
    if (!canPay || loading || !$selectedProduct) return;
    
    loading = true;
    error = '';
    
    try {
      const response = await fetch('/api/sheets/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: $selectedProduct.id,
          quantity: $quantity,
          total: subtotal,
          userId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        userBalance.set(data.newBalance);
        selectedProduct.set(null);
        quantity.set(1);
      } else {
        error = data.error || 'Error al procesar el pago';
      }
    } catch (err) {
      error = 'Error al procesar el pago';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadProducts();
    loadUserBalance();
  });
</script>

<div class="h-screen flex flex-col">
  <!-- Fixed Header -->
  <header class="bg-[#35528C] text-white h-16 flex items-center justify-between px-6 shadow-lg fixed w-full top-0 z-50">
    <h1 class="text-2xl font-bold">InterPOS</h1>
    <div class="flex items-center gap-4">
      <span class="text-sm">Saldo: ${$userBalance.toFixed(2)}</span>
      <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="flex flex-1 pt-16">
    <!-- Left Panel (70%) -->
    <div class="w-[70%] h-full p-6 overflow-y-auto">
      <!-- Categories -->
      <div class="bg-white rounded-lg shadow p-6 mb-6">
        <h2 class="text-xl font-semibold mb-4">Categorías</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each categories as category}
            <button
              class="p-4 rounded-lg text-center transition-colors duration-200
                     {$selectedCategory === category ? 
                     'bg-[#35528C] text-white' : 
                     'bg-gray-100 hover:bg-gray-200 text-gray-800'}"
              on:click={() => selectedCategory.set(category)}
            >
              {category}
            </button>
          {/each}
        </div>
      </div>

      <!-- Products -->
      {#if $selectedCategory}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Productos - {$selectedCategory}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each products[$selectedCategory] || [] as product}
              <button
                class="p-4 rounded-lg border transition-all duration-200 text-left
                       {$selectedProduct?.id === product.id ? 
                       'border-[#35528C] ring-2 ring-[#35528C] bg-blue-50' : 
                       'border-gray-200 hover:border-[#35528C]'}"
                on:click={() => selectedProduct.set(product)}
              >
                <h3 class="font-semibold">{product.name}</h3>
                <p class="text-gray-600">${product.price.toFixed(2)}</p>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Panel (30%) -->
    <div class="w-[30%] h-full bg-gray-50 p-6 border-l">
      {#if $selectedProduct}
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg mb-4">
              <!-- Product image placeholder -->
              <div class="w-full h-full flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            <h2 class="text-xl font-bold mb-2">{$selectedProduct.name}</h2>
            <p class="text-2xl font-bold text-[#35528C] mb-4">${$selectedProduct.price.toFixed(2)}</p>

            <div class="space-y-4">
              <div>
                <input
                  type="number"
                  bind:value={$quantity}
                  min="1"
                  class="w-full p-2 border border-gray-300 rounded-md focus:ring-[#35528C] focus:border-[#35528C]"
                />
              </div>

              <div class="border-t pt-4">
                <div class="flex justify-between text-sm mb-2">
                  <span>Subtotal:</span>
                  <span class="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-sm mb-4">
                  <span>Tu saldo:</span>
                  <span class="font-semibold">${$userBalance.toFixed(2)}</span>
                </div>

                {#if error}
                  <p class="text-red-600 text-sm mb-4">{error}</p>
                {/if}

                <button
                  class="w-full py-3 px-4 rounded-md font-semibold text-white transition-colors duration-200
                         {canPay ? 'bg-[#35528C] hover:bg-[#2A4170]' : 'bg-gray-400 cursor-not-allowed'}"
                  disabled={!canPay || loading}
                  on:click={handlePayment}
                >
                  {loading ? 'Procesando...' : 'Pagar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="h-full flex items-center justify-center text-gray-500">
          Selecciona un producto para ver sus detalles
        </div>
      {/if}
    </div>
  </main>
</div>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  
  let categories: string[] = [];
  let products: Record<string, any[]> = {};
  let selectedCategory: string | null = null;
  let selectedProduct: any = null;
  let quantity = 1;
  let userId = '';
  let userBalance = 0;
  let loading = false;
  let error = '';
  let siteName = 'InterPOS';

  // Load user balance
  async function loadUserBalance() {
    if (!userId) return;
    error = '';
    try {
      const response = await fetch(`/api/sheets/users/balance?userId=${userId}`);
      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }
      const data = await response.json();
      if (data.success) {
        userBalance = data.balance;
      } else {
        throw new Error(data.error || 'Error al cargar el saldo');
      }
    } catch (err: any) {
      error = err.message || 'Error al cargar el saldo';
      console.error('Error loading balance:', err);
    }
  }

  // Load categories and products
  async function loadProducts() {
    error = '';
    try {
      const response = await fetch('/api/sheets/products');
      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.products)) {
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
      } else {
        throw new Error(data.error || 'Error al cargar los productos');
      }
    } catch (err: any) {
      error = err.message || 'Error al cargar los productos';
      console.error('Error loading products:', err);
    }
  }

  // Handle category selection
  function selectCategory(category: string) {
    selectedCategory = category.trim();
    selectedProduct = null;
    quantity = 1;
  }

  // Handle product selection
  function selectProduct(product: any) {
    selectedProduct = product;
    quantity = 1;
  }

  // Calculate subtotal
  $: subtotal = selectedProduct ? selectedProduct.price * quantity : 0;

  // Check if user can pay
  $: canPay = userBalance >= subtotal && subtotal > 0 && userId;

let posType = '';

  // Carrito de compras
  let cart: any[] = [];

  function addToCart(product: any) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ ...product, quantity });
    }
    selectedProduct = null;
    quantity = 1;
  }

  function removeFromCart(productId: string) {
    cart = cart.filter(item => item.id !== productId);
  }

  function clearCart() {
    cart = [];
  }

  $: cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Handle payment
  async function handlePayment() {
    if (!canPay || loading || !userId || cart.length === 0) return;
    posType = prompt('Ingresa el tipo de POS para facturar (ejemplo: físico, virtual, etc.):') || '';
    if (!posType) {
      error = 'Debes ingresar el tipo de POS para facturar.';
      return;
    }
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/sheets/sell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          posType,
          products: cart.map(item => ({ id: item.id, quantity: item.quantity })),
          total: cartTotal
        })
      });
      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }
      const data = await response.json();
      if (data.success) {
        userBalance = data.newBalance;
        clearCart();
        posType = '';
      } else {
        throw new Error(data.error || 'Error al procesar el pago');
      }
    } catch (err: any) {
      error = err.message || 'Error al procesar el pago';
      console.error('Error processing payment:', err);
    } finally {
      loading = false;
    }
  }

  // Watch for userId changes
  $: if (userId) {
    loadUserBalance();
  }

  onMount(() => {
    loadProducts();
  });
</script>

<svelte:head>
  <title>Venta | {siteName}</title>
  <meta name="description" content="Realiza una venta y descuenta productos del saldo del usuario" />
</svelte:head>


  <!-- User Input Section -->
  <div class="w-full md:w-[70%] mx-auto mb-8">
    <div class="bg-white rounded-lg shadow p-6">
      <label class="block text-sm font-medium text-gray-700 mb-2" for="userId">
        ID de Usuario
      </label>
      <div class="flex gap-4">
        <input
          type="text"
          id="userId"
          bind:value={userId}
          class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-[#35528C] focus:ring-[#35528C]"
          placeholder="Ingresa el ID de usuario"
        />
        {#if userBalance > 0}
          <div class="bg-[#35528C] text-white px-4 py-2 rounded-md flex items-center">
            <span class="font-medium">Saldo: ${userBalance.toFixed(2)}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if error}
    <div class="w-full md:w-[70%] mx-auto mb-8">
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    </div>
  {/if}

  <!-- Categories and Products -->
  <div class="flex flex-col md:flex-row gap-6">
    <!-- Panel izquierdo: categorías y productos -->
    <div class="w-full md:w-[70%] space-y-6">
      <!-- Categorías -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Categorías</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {#each categories as category}
            <button
              class="p-4 rounded-lg text-center transition-colors duration-200 {selectedCategory === category ? 'bg-[#35528C] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}"
              on:click={() => selectCategory(category)}
            >
              {category}
            </button>
          {/each}
        </div>
      </div>
      <!-- Productos -->
      {#if selectedCategory && products[selectedCategory]}
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">Productos - {selectedCategory}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each products[selectedCategory] as product}
              <button
                class="p-4 rounded-lg border transition-all duration-200 text-left {selectedProduct?.id === product.id ? 'border-[#35528C] ring-2 ring-[#35528C] bg-blue-50' : 'border-gray-200 hover:border-[#35528C]'}"
                on:click={() => selectProduct(product)}
              >
                <h3 class="font-semibold">{product.name}</h3>
                <p class="text-gray-600">${product.price.toFixed(2)}</p>
              </button>
            {/each}
          </div>
        </div>
      {/if}
      <!-- Detalle y añadir al carrito -->
      {#if selectedProduct}
        <div class="bg-white rounded-lg shadow p-6 mt-4">
          <h2 class="text-xl font-semibold mb-4">Añadir al carrito</h2>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Cantidad</label>
            <input type="number" bind:value={quantity} min="1" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#35528C] focus:ring-[#35528C]" />
            <button class="w-full py-2 px-4 rounded-md font-semibold text-white bg-[#35528C] hover:bg-[#2A4170] mt-2" on:click={addToCart}>Añadir al carrito</button>
          </div>
        </div>
      {/if}
    </div>
    <!-- Panel derecho: carrito -->
    <div class="w-full md:w-[30%]">
      <div class="bg-white rounded-lg shadow p-6 sticky top-4">
        <h2 class="text-xl font-semibold mb-4">Carrito</h2>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2" for="userId">ID de Usuario</label>
          <input type="text" id="userId" bind:value={userId} class="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#35528C] focus:ring-[#35528C]" placeholder="Ingresa el ID de usuario" />
          {#if userBalance > 0}
            <div class="bg-[#35528C] text-white px-4 py-2 rounded-md flex items-center mt-2">
              <span class="font-medium">Saldo: ${userBalance.toFixed(2)}</span>
            </div>
          {/if}
        </div>
        {#if cart.length === 0}
          <div class="text-gray-500">El carrito está vacío.</div>
        {:else}
          <ul class="divide-y divide-gray-200 mb-4">
            {#each cart as item}
              <li class="py-2 flex justify-between items-center">
                <div>
                  <span class="font-semibold">{item.name}</span> x {item.quantity}
                  <span class="ml-2 text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <button class="text-red-500 hover:underline ml-2" on:click={() => removeFromCart(item.id)}>Eliminar</button>
              </li>
            {/each}
          </ul>
          <div class="flex justify-between text-sm mb-2">
            <span>Total:</span>
            <span class="font-semibold">${cartTotal.toFixed(2)}</span>
          </div>
          <button class="w-full py-3 px-4 rounded-md font-semibold text-white transition-colors duration-200 {canPay ? 'bg-[#35528C] hover:bg-[#2A4170]' : 'bg-gray-400 cursor-not-allowed'}" disabled={!canPay || loading} on:click={handlePayment}>
            {loading ? 'Procesando...' : 'Pagar'}
          </button>
        {/if}
        {#if error}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">{error}</div>
        {/if}
      </div>
    </div>
  </div>



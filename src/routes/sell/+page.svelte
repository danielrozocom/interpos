Al qu<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  let cart: any[] = [];
  let cartTotal = 0;
  let posType = '';
  let quickAddId = '';
  let quickAddQuantity = '1';
  let suggestions: any[] = [];

  let searchResults: any[] = [];
  let searchTerm = '';

  let userName = '';

let userSuggestions: any[] = [];
let successMsg = '';
let mobileView = 'products'; // 'products' or 'cart' for mobile view switching
let showAddedNotification = false;

// Scanner modal state (dynamic import to keep SSR-safe)
let showScanner = false;
let Scanner: any = null;

onMount(async () => {
  // load scanner lazily to avoid SSR issues
  try {
    const mod = await import('../../lib/Scanner.svelte');
    Scanner = mod.default;
  } catch (e) {
    // ignore; will try dynamic load on open
  }
});

function openScanner() {
  if (!Scanner) {
    // attempt dynamic import and then open
    import('../../lib/Scanner.svelte').then(m => { Scanner = m.default; showScanner = true; }).catch(err => { console.error('Error loading Scanner', err); error = 'Escáner no disponible'; });
    return;
  }
  showScanner = true;
}

function closeScanner() { showScanner = false; }

function handleScannedSell(ev: Event) {
  const e = ev as CustomEvent;
  const detail = e.detail || {};
  let raw: string | undefined = undefined;
  let derivedUserId: string | null = null;

  if (detail.value) raw = String(detail.value);
  else if (detail.raw) raw = String(detail.raw);

  if (detail.userId) derivedUserId = String(detail.userId);

  if (!derivedUserId && raw) {
    const digits = raw.replace(/[^0-9]/g, '');
    derivedUserId = digits.length > 0 ? digits : raw;
  }

  if (derivedUserId) {
    userId = derivedUserId;
  // clear suggestions so the lookup is immediate
  userSuggestions = [];
  // behave exactly like pressing Enter
  performEnterLookup();
  showScanner = false;
  // focus input after a tick
  tick().then(() => { const el2 = document.getElementById('userId') as HTMLInputElement | null; if (el2) el2.focus(); });
    return;
  }

  // If nothing could be derived, still close and show an error
  showScanner = false;
  error = 'Se leyó un código pero no se pudo extraer un ID';
}

// Central helper: perform the lookup that Enter would perform
function performEnterLookup() {
  // if empty, show message and clear suggestions
  if (!userId || String(userId).trim() === '') {
    userSuggestions = [];
    error = 'No se encontraron usuarios';
    return;
  }
  // otherwise clear suggestions and load
  userSuggestions = [];
  loadUserBalance(true);
}

// Cargar preferencia de ordenamiento desde localStorage
let sortByAlphabetical = typeof window !== 'undefined' ? 
  localStorage.getItem('sortByAlphabetical') !== 'false' : true; // true = alfabético, false = por ID

// Payment method variables
let paymentMethod = 'saldo'; // 'saldo' or 'efectivo'
let cashReceived = 0;
let cashChange = 0;
let showCashModal = false;

  // Load user balance
  async function loadUserBalance(showErrors = false) {
    if (!userId) {
      userBalance = 0;
      userName = '';
      return;
    }
    if (!showErrors) {
      error = '';
    }
    try {
      const response = await fetch(`/api/sheets/users?userId=${encodeURIComponent(userId)}`);
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        userBalance = 0;
        userName = '';
        if (showErrors) {
          throw new Error('La respuesta del servidor no es válida (no es JSON).');
        }
        return;
      }
      if (!response.ok) {
        userBalance = 0;
        userName = '';
        if (showErrors) {
          const errorMessage = data?.message || data?.error || 'Error al cargar el usuario';
          throw new Error(errorMessage);
        }
        return;
      }
      
      if (data.balance !== undefined && data.name !== undefined) {
        userBalance = parseFloat(data.balance) || 0;
        userName = data.name;
      } else {
        userBalance = 0;
        userName = '';
        if (showErrors) {
          throw new Error('No se encontraron usuarios');
        }
      }
    } catch (err: any) {
      error = err.message || 'Error al cargar el saldo';
      console.error('Error loading balance:', err);
      userBalance = 0;
    }
  }


  // Search products by ID or name (single robust version)
  async function searchProducts() {
    try {
      let productsArr = [];
      let data;
      // Realizar fetch si searchTerm existe
      if (searchTerm && searchTerm.trim()) {
        const response = await fetch(`/api/sheets/products?search=${encodeURIComponent(searchTerm)}`);
        try {
          data = await response.json();
        } catch (jsonErr) {
          throw new Error('La respuesta del servidor de productos no es válida (no es JSON).');
        }
        if (!response.ok) {
          const errorMessage = data?.message || data?.error || 'Error al buscar productos';
          throw new Error(errorMessage);
        }
        if (data.success && data.products && Array.isArray(data.products)) {
          productsArr = data.products;
        } else if (Array.isArray(data)) {
          productsArr = data;
        }
        // Filtrar productos válidos
        searchResults = productsArr.filter(p => p?.id && p?.name && typeof p?.price === 'number');
      } else {
        searchResults = [];
      }
    } catch (err: any) {
      error = err.message || 'Error al buscar productos';
      console.error('Error searching products:', err);
      searchResults = [];
    }
  }

  // Watch for search term changes (single reactive statement)
  $: if (searchTerm && searchTerm.trim()) {
    searchProducts();
  } else {
    searchResults = [];
  }

  // Load categories and products
  async function loadProducts() {
    try {
      const response = await fetch('/api/sheets/products');
      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        throw new Error('La respuesta del servidor de productos no es válida (no es JSON).');
      }
      if (!response.ok) {
        const errorMessage = data?.message || data?.error || 'Error al cargar productos';
        throw new Error(errorMessage);
      }
      
      let productsArray = [];
      if (data.success && data.products && Array.isArray(data.products)) {
        productsArray = data.products;
      } else if (Array.isArray(data)) {
        productsArray = data;
      }

      // Group products by category
      const productsByCategory: Record<string, any[]> = {};
      productsArray.forEach((product: any) => {
        if (product.category) {
          if (!productsByCategory[product.category]) {
            productsByCategory[product.category] = [];
          }
          productsByCategory[product.category].push(product);
        }
      });
      categories = Object.keys(productsByCategory);
      products = productsByCategory;
    } catch (err: any) {
      error = err.message || 'Error al cargar los productos';
      console.error('Error loading products:', err);
    }
  }

  // Load products on mount
  onMount(() => {
    loadProducts();
  });

  // Handle category selection
  function selectCategory(category: string) {
    selectedCategory = category;
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

  function addToCart(product: any) {
    // Validar que el producto tenga todos los datos requeridos y que el precio sea número
    if (!product?.id || !product?.name || typeof product?.price !== 'number') {
      error = 'Error: El producto no tiene todos los datos requeridos o el precio no es válido';
      return;
    }
    if (!quantity || quantity < 1 || isNaN(quantity)) {
      error = 'La cantidad debe ser mayor a 0';
      return;
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + quantity;
      cart = cart; // Trigger reactivity
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity
      });
      cart = cart; // Trigger reactivity
    }
    // Recalculate cart total
    cartTotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 0)), 0);
    error = ''; // Limpiar cualquier error previo
  }

  function clearCart() {
    cart = [];
    cartTotal = 0;
  }

  async function handlePayment() {
    error = '';

    // Validar que haya productos en el carrito
    if (!cart.length) {
      error = 'El carrito está vacío';
      return;
    }

    // Validar ID de usuario SIEMPRE, incluso para pagos en efectivo
    if (!userId?.trim()) {
      const userIdInput = document.getElementById('userId');
      userIdInput?.focus();
      userIdInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      error = 'Debes ingresar un ID de usuario.';
      return;
    }

    // Validar si el usuario existe (siempre)
    if (!userName) {
      error = 'No se encontró el usuario con el ID proporcionado';
      return;
    }

    // Validar saldo para pagos con saldo
    if (paymentMethod === 'saldo') {
      const newBalance = userBalance - cartTotal;
      if (newBalance < 0) {
        const confirmMessage = `⚠️ El usuario quedará con un saldo de $${newBalance.toLocaleString('es-CO')} ⚠️\n\n` +
                             `💰 Saldo actual: $${userBalance.toLocaleString('es-CO')}\n` +
                             `🛒 Total: $${cartTotal.toLocaleString('es-CO')}\n` +
                             `📉 Nuevo saldo: $${newBalance.toLocaleString('es-CO')}\n\n` +
                             `❓ ¿Acepta asumir la deuda?`;
        
        const proceed = window.confirm(confirmMessage);
        if (!proceed) {
          return;
        }
      }
    }

    // Verificar que todas las cantidades sean válidas y los productos tengan datos completos
    for (const item of cart) {
      // Validar que id y name sean string/number y price sea un número válido
      if (typeof item.id === 'undefined' || item.id === null || String(item.id).trim() === '' || typeof item.name !== 'string' || item.name.trim() === '' || typeof item.price !== 'number' || isNaN(item.price)) {
        error = `El producto "${item.name || item.id || 'Sin nombre'}" tiene datos incompletos. Verifica ID, nombre y precio.`;
        return;
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1 || isNaN(item.quantity)) {
        error = `Por favor verifica la cantidad del producto: ${item.name || item.id || 'Sin nombre'}`;
        return;
      }
    }

    loading = true;
    try {
      // Calcular el nuevo saldo (solo para pagos con saldo)
      const newBalance = paymentMethod === 'saldo' ? userBalance - cartTotal : userBalance;
      
      // Obtener el próximo OrderID numérico
      let orderID = '000000'; // Valor por defecto en caso de error
      try {
        const orderResponse = await fetch('/api/sheets/orders');
        const orderData = await orderResponse.json();
        if (orderData.success) {
          orderID = orderData.nextOrderId;
        }
      } catch (orderError) {
        console.error('Error obteniendo OrderID:', orderError);
        // Usar timestamp como fallback pero formateado a 6 dígitos
        const fallbackId = (Date.now() % 1000000).toString().padStart(6, '0');
        orderID = fallbackId;
      }
      
      // Preparar datos de la transacción usando zona horaria de Colombia
      const gmt5Date = new Date().toLocaleString("en-CA", {timeZone: "Etc/GMT+5"}).split(' ')[0]; // YYYY-MM-DD
      // Preparar datos de la transacción
      const transactionData = {
        date: gmt5Date,
        orderID: orderID,
        userID: userId, // SIEMPRE usar el ID ingresado
        userName: userName, // SIEMPRE usar el nombre encontrado
        quantity: cartTotal,
        products: cart.map(item => `${item.name} (ID: ${item.id}) x${item.quantity} - $${(item.price * item.quantity).toLocaleString('es-CO')}`).join('; '),
        paymentMethod: paymentMethod === 'saldo' ? 'Saldo' : 'Efectivo',
        cashReceived: paymentMethod === 'efectivo' ? cashReceived : null,
        cashChange: paymentMethod === 'efectivo' ? cashChange : null
      };
      
      // Registrar la transacción (esto actualizará el saldo si es pago con saldo)
      console.log('=== SENDING TRANSACTION DATA ===');
      console.log('Transaction data to send:', {
        ...transactionData,
        currentBalance: userBalance,
        newBalance: paymentMethod === 'saldo' ? newBalance : userBalance
      });
      console.log('===================================');
      
      const transactionResponse = await fetch('/api/sheets/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transactionData,
          // Incluir el saldo actual para validación en el servidor (solo para pagos con saldo)
          currentBalance: paymentMethod === 'saldo' ? userBalance : 0,
          // Incluir el nuevo saldo calculado (solo para pagos con saldo)
          newBalance: paymentMethod === 'saldo' ? newBalance : 0
        })
      });

      const transactionResult = await transactionResponse.json();
      console.log('Transacción registrada:', transactionResult);
      
      if (!transactionResponse.ok) {
        throw new Error(transactionResult.error || 'Error al registrar la transacción');
      }

      // Clear data for new transaction using tick to ensure reactive context
      await tick();
      clearCart();
      
      // Limpiar todos los datos del usuario después de completar cualquier venta
      userId = '';
      userName = '';
      userBalance = 0;
      
      posType = '';
      error = '';
      successMsg = 'Venta exitosa';
      
      // Scroll to top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      setTimeout(() => { successMsg = ''; }, 2000);
        
    } catch (err: any) {
      error = err.message || 'Error al procesar el pago';
      console.error('Error processing payment:', err);
    } finally {
      loading = false;
    }
  }

  // Handle cash payment modal
  function openCashModal() {
    if (paymentMethod === 'efectivo') {
      cashReceived = 0;
      cashChange = 0;
      showCashModal = true;
    } else {
      handlePayment();
    }
  }

  function processCashPayment() {
    if (cashReceived < cartTotal) {
      error = `Efectivo insuficiente. Se necesitan $${cartTotal.toLocaleString('es-CO')} y se recibieron $${cashReceived.toLocaleString('es-CO')}`;
      return;
    }
    cashChange = cashReceived - cartTotal;
    showCashModal = false;
    handlePayment();
  }

  function closeCashModal() {
    showCashModal = false;
    cashReceived = 0;
    cashChange = 0;
    error = '';
  }

  // Load products on mount
  onMount(() => {
    loadProducts();
  });

  // Combine search results and all products for display
  $: displayProducts = searchTerm ? searchResults : Object.values(products).flat();

  // Buscar sugerencias de usuario por ID o nombre, priorizando coincidencias exactas y luego parciales
  async function fetchUserSuggestions(term: string) {
    if (!term.trim()) {
      userSuggestions = [];
      return;
    }
    try {
      const response = await fetch(`/api/sheets/users?search=${encodeURIComponent(term)}`);
      let data = await response.json();
      let usersArr = [];
      if (response.ok && Array.isArray(data.users)) {
        usersArr = data.users;
      } else if (Array.isArray(data)) {
        usersArr = data;
      }
      // Prioridad: coincidencia exacta por ID, luego por nombre, luego comienza con, luego incluye
      const exactId = usersArr.filter(u => u.id && u.id.toString() === term);
      const exactName = usersArr.filter(u => u.name && u.name.toLowerCase() === term.toLowerCase() && !exactId.includes(u));
      const startWithId = usersArr.filter(u => u.id && u.id.toString().startsWith(term) && !exactId.includes(u));
      const startWithName = usersArr.filter(u => u.name && u.name.toLowerCase().startsWith(term.toLowerCase()) && !exactName.includes(u) && !startWithId.includes(u));
      const partialName = usersArr.filter(u => u.name && u.name.toLowerCase().includes(term.toLowerCase()) && !exactId.includes(u) && !exactName.includes(u) && !startWithId.includes(u) && !startWithName.includes(u));
      userSuggestions = [...exactId, ...exactName, ...startWithId, ...startWithName, ...partialName].slice(0, 5);
    } catch {
      userSuggestions = [];
    }
  }

  $: if (userId.length > 0 && !userName && !error) {
    fetchUserSuggestions(userId);
  }

  // Guardar preferencia de ordenamiento en localStorage
  $: if (typeof window !== 'undefined') {
    localStorage.setItem('sortByAlphabetical', sortByAlphabetical.toString());
  }
</script>

<svelte:head>
  <title>{siteName}</title>
</svelte:head>

<div class="w-full h-screen flex flex-col md:flex-row overflow-hidden">
  <!-- Mobile Navigation Tabs -->
  <div class="md:hidden bg-white border-b border-gray-200 flex">
    <button
      class="flex-1 py-3 px-4 text-center font-medium transition-colors duration-200"
      class:bg-primary={mobileView === 'products'}
      class:text-white={mobileView === 'products'}
      class:text-primary={mobileView !== 'products'}
      on:click={() => mobileView = 'products'}
    >
      Productos
      <span class="ml-1 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
        {Object.values(products).flat().length}
      </span>
    </button>
    <button
      class="flex-1 py-3 px-4 text-center font-medium transition-colors duration-200 relative"
      class:bg-primary={mobileView === 'cart'}
      class:text-white={mobileView === 'cart'}
      class:text-primary={mobileView !== 'cart'}
      on:click={() => mobileView = 'cart'}
    >
      Carrito
      {#if cart.length > 0}
        <span class="ml-1 text-xs bg-red-500 text-white px-2 py-1 rounded-full">
          {cart.length}
        </span>
      {:else}
        <span class="ml-1 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
          0
        </span>
      {/if}
    </button>
  </div>

  <div class="flex-1 flex flex-col md:flex-row overflow-hidden w-full" style="margin:0; padding:0;">
    <!-- Grid de productos -->
    <div class="flex-1 p-1 sm:p-2 overflow-auto" class:hidden={mobileView !== 'products'} class:md:block={true}>
      <!-- Filtro por categorías -->
      <div class="mb-2 px-1 sm:px-2">
        <div class="flex flex-wrap gap-1 sm:gap-2 items-center">
          <button
            class="px-2 sm:px-4 py-2 rounded-lg border font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-150 text-sm sm:text-base"
            style="background-color: {selectedCategory === null ? '#35528C' : '#f3f4f6'}; color: {selectedCategory === null ? 'white' : '#35528C'}; border-color: {selectedCategory === null ? '#35528C' : '#d1d5db'};"
            on:click={() => selectedCategory = null}
          >
            Todos
          </button>
          {#each categories as cat}
            <button
            class="px-2 sm:px-4 py-2 rounded-lg border font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-150 text-sm sm:text-base"
            style="background-color: {selectedCategory === cat ? '#35528C' : '#f3f4f6'}; color: {selectedCategory === cat ? 'white' : '#35528C'}; border-color: {selectedCategory === cat ? '#35528C' : '#d1d5db'};"
              on:click={() => selectCategory(cat)}
            >
              {cat}
            </button>
          {/each}
          
          <!-- Separador y switch para ordenamiento -->
          <span class="text-gray-300 mx-1">|</span>
          <button
            on:click={() => sortByAlphabetical = !sortByAlphabetical}
            class="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-xs sm:text-sm text-gray-600"
            title="Cambiar ordenamiento"
          >
            <span>{sortByAlphabetical ? 'A-Z' : 'ID'}</span>
            <div class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 {sortByAlphabetical ? 'bg-primary' : 'bg-gray-300'}">
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 {sortByAlphabetical ? 'translate-x-5' : 'translate-x-0.5'}"></span>
            </div>
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 w-full" style="margin:0;">
        {#if (selectedCategory ? products[selectedCategory] : Object.values(products).flat()).length > 0}
          {#each (selectedCategory ? products[selectedCategory] : Object.values(products).flat()).sort((a, b) => {
            if (sortByAlphabetical) {
              // Ordenar alfabéticamente por nombre
              return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
            } else {
              // Ordenar por ID numérico
              const numA = parseInt(a.id);
              const numB = parseInt(b.id);
              if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
              }
              return String(a.id).localeCompare(String(b.id));
            }
          }) as product}
            <div
              class="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer p-2 sm:p-3 relative group border border-primary"
              on:click={() => {
                const newProduct = {
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  quantity: 1
                };
                const existing = cart.find(item => item.id === product.id);
                if (existing) {
                  existing.quantity++;
                  cart = cart;
                } else {
                  cart = [...cart, newProduct];
                }
                cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                // Show mobile notification
                if (window.innerWidth < 768) {
                  showAddedNotification = true;
                  setTimeout(() => showAddedNotification = false, 1500);
                }
              }}
            >
              <div class="text-xs sm:text-sm text-primary mb-1 sm:mb-2 font-medium">ID: {product.id}</div>
              <div class="w-full relative group">
                <div 
                  class="font-semibold text-sm sm:text-lg mb-1 sm:mb-2 block truncate product-name-hover" 
                  style="color:#35528C;"
                  title="{product.name}"
                >
                  {product.name}
                </div>
                <!-- Tooltip que aparece en hover -->
                <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-50 mb-1">
                  {product.name}
                </div>
              </div>
              <p class="text-base sm:text-xl font-bold" style="color:#35528C">
                ${product.price.toLocaleString('es-CO')}
              </p>
              <div class="absolute inset-0 bg-white bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded-lg">
                <!-- Removed quick add indicator -->
              </div>
            </div>
          {/each}
        {:else}
          <div class="col-span-full flex flex-col items-center justify-center py-8 md:py-12 text-gray-500">
            <p class="text-lg md:text-xl">No hay productos disponibles</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Floating Cart Button for Mobile (only visible in products view) -->
    <div class="md:hidden fixed bottom-4 right-4 z-40" class:hidden={mobileView !== 'products' || cart.length === 0}>
      <button
        on:click={() => mobileView = 'cart'}
        class="bg-primary text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A1 1 0 007.5 17h9a1 1 0 00.9-1.45L17 13M7 13V6h13" />
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
        </svg>
        <span class="font-bold">{cart.length}</span>
      </button>
    </div>

    <!-- Panel derecho - Cliente y Carrito -->
    <div class="w-full md:w-[380px] lg:w-[420px] bg-white shadow-lg flex flex-col h-full md:h-screen sticky top-0" class:hidden={mobileView !== 'cart'} class:md:flex={true} style="margin:0; padding:0; max-height: 100vh;">
      <!-- Cliente -->
      <div class="p-3 md:p-4 border-b bg-blue-50/40">
        <div class="flex items-center gap-2">
          <div class="p-2 rounded-full bg-[#e6eaf2] border border-primary shadow-sm">
            <svg class="w-5 h-5 md:w-6 md:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <input
            id="userId"
            type="text"
            bind:value={userId}
            on:keydown={(e) => {
              if (e.key === 'Enter') {
                // si está vacío, mostrar mensaje inmediato
                if (!userId || String(userId).trim() === '') {
                  error = 'No se encontraron usuarios';
                  userSuggestions = [];
                  return;
                }
                // limpiar sugerencias para que la consulta sea inmediata
                userSuggestions = [];
                loadUserBalance(true);
              }
            }}
            on:input={() => {
              error = '';
              userSuggestions = [];
              fetchUserSuggestions(userId);
            }}
            class="flex-1 px-3 py-2 border border-primary rounded-lg text-base focus:ring-2 focus:ring-primary focus:border-primary bg-white placeholder-[#35528C] transition-all duration-150 shadow-sm"
            placeholder="ID de Cliente"
            autocomplete="off"
            spellcheck="false"
            aria-label="ID de Cliente"
            autofocus
          />
          <button
            type="button"
            class="h-10 w-10 p-1 rounded-lg flex items-center justify-center bg-[#35528C] text-white shadow-sm hover:bg-[#2A4170] focus:outline-none focus:ring-2 focus:ring-[#35528C]/40"
            aria-label="Escanear código de cliente"
            title="Escanear código"
            on:click={openScanner}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h3l2-2h6l2 2h3v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <circle cx="12" cy="13" r="3.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
    {#if showScanner && Scanner}
      <svelte:component
        this={Scanner}
        on:close={closeScanner}
        on:scanned={handleScannedSell}
        continuous={false}
        debounceMs={800}
      />
    {/if}
        {#if userName}
          <div class="mt-2 flex flex-col gap-1">
            <p class="text-sm md:text-base text-gray-600">Cliente: <span class="font-medium text-gray-900">{userName}</span></p>
            <p class="text-sm md:text-base text-gray-600">Saldo: <span class="font-medium text-primary">${userBalance.toLocaleString('es-CO')}</span></p>
            {#if cartTotal > 0 && paymentMethod === 'saldo'}
              <p class="text-sm text-primary mt-1">Saldo tras la compra: <span class="font-bold text-primary">${(userBalance - cartTotal).toLocaleString('es-CO')}</span></p>
            {/if}
          </div>
        {/if}
        <!-- Sugerencias de usuario, error y éxito debajo del input -->
        {#if userId.length > 0 && !userName}
          <div class="mt-2 text-sm">
            {#if userSuggestions.length > 0}
              <div class="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                {#each userSuggestions as suggestion}
                  <button type="button" class="w-full text-left px-4 py-2 hover:bg-[#e6eaf2] flex items-center gap-2"
                    on:click={() => {
                      userId = suggestion.id;
                      loadUserBalance(true);
                      userSuggestions = [];
                    }}
                  >
                    <span class="text-primary font-medium">ID: {suggestion.id}</span>
                    <span class="text-gray-400">|</span>
                    <span>{suggestion.name}</span>
                  </button>
                {/each}
              </div>
            {:else}
              {#if error && error.includes('usuario')}
                <div class="text-red-600 animate-fade-in">{error}</div>
                {#key error}
                  {#await new Promise(resolve => setTimeout(resolve, 2000))}
                  {:then}
                    {error = ''}
                  {/await}
                {/key}
              {:else}
                <span class="text-gray-500">No se encontraron usuarios</span>
              {/if}
            {/if}
          </div>
        {/if}
        {#if successMsg}
          <div class="mt-2 text-lg font-bold text-green-600 animate-fade-in bg-green-50 border border-green-200 rounded-lg px-3 py-2 shadow-sm">{successMsg}</div>
        {/if}
      </div>

      <!-- Carrito -->
      <div class="flex-1 overflow-y-auto" style="height: calc(100vh - 200px);">
        <!-- Quick Add Form -->
        <div class="p-2 sm:p-4 border-b">
          <form class="flex space-x-2 relative"
            on:submit|preventDefault={() => {
              const searchInput = quickAddId.trim();
              if (!searchInput) return;
              
              // Verificar si el input tiene el formato ID*cantidad
              const match = searchInput.match(/^(\d+)\s*[\*x]\s*(\d+)$/);
              let searchId = searchInput;
              let quantity = 1;
              
              if (match) {
                searchId = match[1];
                quantity = parseInt(match[2]);
                if (quantity < 1) quantity = 1;
              }
              
              // Buscar por ID exacto primero
              let product = displayProducts.find(p => 
                p.id.toString() === searchId
              );
              
              // Si no se encuentra por ID exacto, buscar por nombre exacto
              if (!product) {
                product = displayProducts.find(p => 
                  p.name.toLowerCase() === searchId.toLowerCase()
                );
              }
              
              // Si aún no se encuentra, buscar el primer producto que contenga el texto en el nombre
              if (!product && suggestions.length > 0) {
                product = suggestions[0];
              }
              
              if (product) {
                const newProduct = {
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  quantity: quantity
                };
                
                const existing = cart.find(item => item.id === product.id);
                if (existing) {
                  existing.quantity += quantity;
                  cart = cart;
                } else {
                  cart = [...cart, newProduct];
                }
                cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                quickAddId = '';
                suggestions = [];
              } else {
                error = 'Producto no encontrado';
                setTimeout(() => error = '', 2000);
              }
            }}>
            <div class="flex-1 relative">
              <input
                type="text"
                bind:value={quickAddId}
                placeholder="Buscar producto | ID o Nombre"
                class="w-full px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autofocus
                on:input={() => {
                  if (!quickAddId.trim()) {
                    suggestions = [];
                    return;
                  }
                  const searchTerm = quickAddId.toLowerCase().trim();
                  
                  // 1. Coincidencia exacta por ID
                  const exactIdMatches = displayProducts.filter(p => 
                    p.id.toString() === quickAddId
                  );
                  
                  // 2. Coincidencia exacta por nombre (ignorando mayúsculas)
                  const exactNameMatches = displayProducts.filter(p => 
                    p.name.toLowerCase() === searchTerm &&
                    !exactIdMatches.includes(p)
                  );
                  
                  // 3. ID comienza con el término de búsqueda
                  const startWithIdMatches = displayProducts.filter(p => 
                    p.id.toString().startsWith(quickAddId) &&
                    !exactIdMatches.includes(p)
                  );
                  
                  // 4. Nombre comienza con el término de búsqueda
                  const startWithNameMatches = displayProducts.filter(p => 
                    p.name.toLowerCase().startsWith(searchTerm) &&
                    !exactNameMatches.includes(p) &&
                    !startWithIdMatches.includes(p)
                  );
                  
                  // 5. Coincidencias parciales en nombre (solo si no hay coincidencias más exactas)
                  const partialMatches = displayProducts.filter(p => 
                    p.name.toLowerCase().includes(searchTerm) &&
                    !exactIdMatches.includes(p) &&
                    !exactNameMatches.includes(p) &&
                    !startWithIdMatches.includes(p) &&
                    !startWithNameMatches.includes(p)
                  );
                  
                  // Combinar resultados en orden de prioridad
                  suggestions = [
                    ...exactIdMatches,
                    ...exactNameMatches,
                    ...startWithIdMatches,
                    ...startWithNameMatches,
                    ...partialMatches
                  ].slice(0, 5); // Limitar a 5 resultados
                }}
                on:blur={() => {
                  // Dar tiempo para que se procese el clic en una sugerencia
                  setTimeout(() => {
                    suggestions = [];
                  }, 200);
                }}
              />
              
              {#if suggestions.length > 0}
                <div class="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-auto">
                  {#each suggestions as suggestion}
                    <button
                      type="button"
                      class="w-full text-left px-4 py-2 hover:bg-blue-50 flex justify-between items-center group"
                      on:mousedown={() => {
                        const newProduct = {
                          id: suggestion.id,
                          name: suggestion.name,
                          price: suggestion.price,
                          quantity: 1
                        };
                        
                        const existing = cart.find(item => item.id === suggestion.id);
                        if (existing) {
                          existing.quantity++;
                          cart = cart;
                        } else {
                          cart = [...cart, newProduct];
                        }
                        cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        quickAddId = '';
                        suggestions = [];
                      }}
                    >
                      <div class="flex-1">
                        <div class="font-medium text-gray-900 flex items-center gap-2">
                          <span class="product-id">ID: {suggestion.id}</span>
                          <span class="text-gray-400">|</span>
                          <span>{suggestion.name}</span>
                        </div>
                      </div>
                      <span class="text-primary font-medium ml-4">
                        ${suggestion.price.toLocaleString('es-CO')}
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </form>
        </div>

        {#if cart.length > 0}
          <div class="p-2 sm:p-4 space-y-2 sm:space-y-3">
            {#each cart as item}
              <div class="flex items-center bg-white rounded-xl shadow group hover:shadow-lg transition-all duration-200 p-2 sm:p-3 md:p-4 relative">
                <!-- Quitar ícono de bolsa aquí -->
                <!-- <div class="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 7l1.5 12.5A2 2 0 006.5 21h11a2 2 0 002-1.5L21 7M16 7V5a4 4 0 00-8 0v2" />
                  </svg>
                </div> -->
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-900 text-sm sm:text-base truncate">{item.name}</p>
                  <div class="flex items-center mt-1 space-x-1 sm:space-x-2">
                    <button 
                      on:click|stopPropagation={() => {
                        if (item.quantity > 1) {
                          item.quantity--;
                        } else {
                          cart = cart.filter(i => i !== item);
                        }
                        cart = cart;
                        cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                      }}
                      class="w-8 h-8 flex items-center justify-center rounded-full bg-[#e6eaf2] text-primary hover:bg-[#d1d9e6] transition-colors duration-200"
                    >
                      -
                    </button>
                    <input 
                      type="number" 
                      bind:value={item.quantity}
                      min="1"
                      class="w-12 sm:w-16 text-center font-bold text-sm sm:text-lg border border-gray-300 rounded-md py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      on:input={() => {
                        if (item.quantity < 1 || isNaN(item.quantity)) {
                          item.quantity = 1;
                        }
                        cart = cart;
                        cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                      }}
                      on:blur={() => {
                        if (!item.quantity || item.quantity < 1) {
                          item.quantity = 1;
                          cart = cart;
                          cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                        }
                      }}
                    />
                    <button 
                      on:click|stopPropagation={() => {
                        item.quantity++;
                        cart = cart;
                        cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                      }}
                      class="w-8 h-8 flex items-center justify-center rounded-full bg-[#e6eaf2] text-primary hover:bg-[#d1d9e6] transition-colors duration-200"
                    >
                      +
                    </button>
                  </div>
                  <p class="text-xs text-gray-500 mt-1">ID: {item.id} | ${item.price.toLocaleString('es-CO')} c/u</p>
                </div>
                <div class="text-right ml-1 sm:ml-2">
                  <p class="font-bold text-primary text-sm sm:text-lg">
                    ${(item.quantity * item.price).toLocaleString('es-CO')}
                  </p>
                </div>
                <!-- Botón de eliminar -->
                <button 
                  on:click|stopPropagation={() => {
                    cart = cart.filter(i => i !== item);
                    cartTotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                  }}
                  class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 opacity-80 group-hover:opacity-100 transition-all duration-200 transform hover:scale-110 shadow-sm border border-white"
                  title="Eliminar"
                  aria-label="Eliminar"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <div class="h-full flex flex-col items-center justify-center text-gray-500">
            <!-- Shopping cart icon -->
            <svg class="w-16 h-16 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A1 1 0 007.5 17h9a1 1 0 00.9-1.45L17 13M7 13V6h13" />
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
            </svg>
            <p class="text-lg">Carrito vacío</p>
            <p class="text-sm text-gray-400">Haz clic en los productos para agregarlos</p>
          </div>
        {/if}
      </div>

      <!-- Total y botones -->
      {#if cart.length > 0}
        <div class="border-t p-2 sm:p-4">
          <div class="flex justify-between items-center mb-3 sm:mb-4">
            <span class="text-gray-600 text-base sm:text-lg">Total</span>
            <span class="text-xl sm:text-2xl font-bold text-primary">${cartTotal.toLocaleString('es-CO')}</span>
          </div>
          
          <!-- Payment Method Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <div class="flex space-x-2">
              <button
                type="button"
                on:click={() => paymentMethod = 'saldo'}
                class="flex-1 py-2 px-3 rounded-lg border-2 transition-all duration-200 {paymentMethod === 'saldo' ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary'}"
              >
                💳 Saldo
              </button>
              <button
                type="button"
                on:click={() => paymentMethod = 'efectivo'}
                class="flex-1 py-2 px-3 rounded-lg border-2 transition-all duration-200 {paymentMethod === 'efectivo' ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-primary'}"
              >
                💵 Efectivo
              </button>
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button
              on:click={openCashModal}
              disabled={loading || !userId || !userName || !paymentMethod || cart.length === 0}
              class="flex-1 bg-primary text-white px-3 sm:px-4 py-2 sm:py-3 rounded-lg hover:bg-[#27406a] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 text-base sm:text-lg font-medium"
              title={!userId ? 'Ingrese ID de usuario' : (!userName ? 'Seleccione el usuario de las sugerencias' : (!paymentMethod ? 'Seleccione método de pago' : (cart.length === 0 ? 'El carrito está vacío' : '')))}
            >
              {loading ? 'Procesando...' : 'FACTURAR'}
            </button>
            <button
              on:click={clearCart}
              class="p-2 sm:p-3 text-red-600 hover:bg-red-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Cash Payment Modal -->
{#if showCashModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
      <h3 class="text-xl font-bold text-gray-900 mb-4">💵 Pago en Efectivo</h3>
      
      <div class="mb-4">
        <p class="text-gray-600 mb-2">Total a pagar:</p>
        <p class="text-2xl font-bold text-primary">${cartTotal.toLocaleString('es-CO')}</p>
      </div>
      
      <div class="mb-4">
        <label for="cashReceived" class="block text-sm font-medium text-gray-700 mb-2">
          Efectivo recibido:
        </label>
        <input
          id="cashReceived"
          type="number"
          bind:value={cashReceived}
          min="0"
          step="100"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
          placeholder="0"
        />
      </div>
      
      {#if cashReceived > 0}
        <div class="mb-4 p-3 bg-gray-50 rounded-lg">
          <div class="flex justify-between items-center">
            <span class="text-gray-600">Cambio:</span>
            <span class="text-lg font-bold {cashReceived >= cartTotal ? 'text-green-600' : 'text-red-600'}">
              ${Math.max(0, cashReceived - cartTotal).toLocaleString('es-CO')}
            </span>
          </div>
          {#if cashReceived < cartTotal}
            <p class="text-red-600 text-sm mt-1">
              Faltan ${(cartTotal - cashReceived).toLocaleString('es-CO')}
            </p>
          {/if}
        </div>
      {/if}
      
      {#if error}
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-red-600 text-sm">{error}</p>
        </div>
      {/if}
      
      <div class="flex space-x-3">
        <button
          on:click={closeCashModal}
          class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          on:click={processCashPayment}
          disabled={cashReceived < cartTotal || loading}
          class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-[#27406a] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Procesando...' : 'Confirmar Pago'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if error && !error.includes('usuario')}
  <!-- Eliminada la alerta roja flotante -->
{/if}

{#if selectedProduct}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" on:click|self={() => selectedProduct = null}>
    <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <h3 class="text-xl font-bold text-primary">{selectedProduct.name}</h3>
          <p class="mt-2 text-2xl font-bold text-primary">${selectedProduct.price.toLocaleString('es-CO')}</p>
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700">Cantidad</label>
          <input
            type="number"
            bind:value={quantity}
            min="1"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
          />
      </div>
      <div class="mt-6 flex space-x-3">
        <button
          on:click={() => {
            addToCart(selectedProduct);
            selectedProduct = null;
          }}
          class="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-[#27406a] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Agregar al carrito
        </button>
        <button
          on:click={() => selectedProduct = null}
          class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
        >
          Cancelar      </button>
    </div>

    <!-- Mobile Added to Cart Notification -->
    {#if showAddedNotification}
      <div class="md:hidden fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
        ✓ Producto agregado al carrito
      </div>
    {/if}
  </div>
  </div>
{/if}

<style>
  /* Animación marquee para texto largo en tarjetas */
  .marquee {
    display: inline-block;
    min-width: 100%;
    animation: marquee 6s linear infinite;
  }
  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-100%); }
  }
  :global(body) {
    background-color: #f3f4f6;
    margin: 0;
    padding: 0;
    font-family: 'Nunito', sans-serif;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
  }
  
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .hover\:scale-102:hover {
    transform: scale(1.02);
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Animación suave para cambios de texto */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  /* Color principal */
  .text-primary {
    color: #35528C;
  }
  .bg-primary {
    background-color: #35528C;
  }
  .border-primary {
    border-color: #35528C;
  }

  /* Simple hover tooltip for product names */
  .product-name-hover {
    position: relative;
  }

  /* Mobile: show full text without truncation */
  @media (max-width: 768px) {
    .product-name-hover {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: unset !important;
      line-height: 1.3;
    }
  }

  .product-id {
    color: #35528C;
  }
</style>
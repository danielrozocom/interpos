<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { siteName } from '../../lib/config';
  import { normalizeUserId } from '../../lib/normalizeUserId';
  // Fetch balance per request

  let userId = '';
  let userName = '';
  let quantity: number | '' = '';
  let method = '';
  let customMethod = '';
  let observations = '';
  let quantityInput: HTMLInputElement | null = null;
  let message = '';
  let loading = false;
  let currentBalance: number | null = null;
  let userExists: boolean = false;
  let allUsers: Array<{id: string, name: string}> = [];
  let userSuggestions: Array<{id: string, name: string}> = [];
  let showScanner = false;
  let ScannerComponent: any = null;

  // Función para validar que solo se ingresen números en el ID
  function validateNumericInput(event: KeyboardEvent) {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowedKeys.includes(event.key)) {
      return; // Permitir teclas de navegación
    }
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault(); // Bloquear cualquier carácter que no sea número
    }
  }

  // Función para limpiar caracteres no numéricos del valor pegado
  function cleanPastedValue(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const numericOnly = pastedText.replace(/[^0-9]/g, '');
    userId = normalizeUserId(numericOnly);
  }

  async function openScanner() {
    showScanner = true;
    if (!ScannerComponent) {
      const mod = await import('../../lib/Scanner.svelte');
      ScannerComponent = mod.default;
    }
  }

  function closeScanner() {
    showScanner = false;
  }

  function handleScannerScanned(ev: CustomEvent) {
    const { userId: scannedId, raw } = ev.detail || {};
    if (scannedId) {
      userId = normalizeUserId(scannedId);
      userSuggestions = [];
      // behave like pressing Enter: fetch balance immediately
      fetchBalance();
      closeScanner();
      tick().then(() => { const el = document.getElementById('userId') as HTMLInputElement | null; if (el) el.focus(); });
    } else if (raw) {
      userId = normalizeUserId(String(raw));
      userSuggestions = [];
      message = 'Leído (sin ID válido)';
    }
  }

  function handleScannerStatus(ev: CustomEvent) {
    console.log('Scanner status', ev.detail);
  }

  function handleScannerError(ev: CustomEvent) {
    console.error('Scanner error', ev.detail);
    message = String(ev.detail || 'Error del escáner');
  }

function formatCurrency(val: number): string {
  return `$${isNaN(val) ? 0 : Math.floor(val).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

  async function fetchAllUsers() {
    try {
      const res = await fetch('/api/sheets/users');
      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudo obtener la lista de usuarios`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Formato de respuesta inválido');
      }

      allUsers = data;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      allUsers = [];
      throw new Error('No se pudo cargar la lista de usuarios');
    }
  }

  onMount(fetchAllUsers);

  function updateSuggestions() {
    if (!userId) {
      userSuggestions = [];
      return;
    }
    userSuggestions = allUsers.filter(u => u.id.startsWith(userId));
  }

  async function fetchBalance() {
    // Normalize manual input before performing the lookup
    if (userId && String(userId).trim() !== '') {
      userId = normalizeUserId(userId);
    }

    if (!userId) {
      currentBalance = null;
      return;
    }
    try {
      const res = await fetch('/api/sheets/users');
      if (!res.ok) {
        throw new Error(`Error ${res.status}: No se pudo obtener la información del usuario`);
      }

      const users = await res.json();
      if (!Array.isArray(users)) {
        throw new Error('Formato de respuesta inválido');
      }

      const user = users.find((u: any) => u.id === userId);
      if (user) {
        userExists = true;
        userName = user.name ?? '';
        let balance = 0;
        
        if (user.balance !== undefined) {
          const numBalance = Number(user.balance);
          if (!isNaN(numBalance)) {
            balance = numBalance;
          }
        }
        
        currentBalance = balance;
      } else {
        userExists = false;
        userName = '';
        currentBalance = null;
      }
    } catch (error) {
      console.error('Error al obtener balance:', error);
      currentBalance = null;
      throw new Error('No se pudo obtener la información del usuario');
    }
  }

  async function updateUserBalance(userId: string, newBalance: number) {
    const response = await fetch('/api/sheets/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newBalance })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Error ${response.status}: No se pudo actualizar el saldo`);
    }

    const data = await response.json();
    return data;
  }

  async function handleSubmit() {
    loading = true;
    message = '';
    try {
      const oldBalance = currentBalance ?? 0;
      const newBalance = oldBalance + Number(quantity);
      let methodToSend = method;
      if (method === 'Otro') {
        methodToSend = customMethod.trim();
      }
      
      // Usar el nuevo endpoint que hace ambas operaciones en una sola llamada
      const response = await fetch('/api/sheets/users/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          quantity, 
          newBalance, 
          method: methodToSend, 
          observations 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Error ${response.status}: No se pudo procesar la recarga`);
      }

  // Mostrar mensaje de éxito y limpiar el formulario
  const successMessage = 'Transacción completada con éxito';
      // Primero limpiar todos los campos
      userId = '';
      userName = '';
      quantity = 0;
      method = '';
      customMethod = '';
      observations = '';
      currentBalance = null;
      userExists = false;
      userSuggestions = [];
      // Mostrar el mensaje después de limpiar todo
      message = successMessage;
      // desplazar al top para que el usuario vea el mensaje
      try { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      // Esperar un momento antes de limpiar el mensaje
      setTimeout(() => {
        message = '';
      }, 3000);
    } catch (error: any) {
      console.error('Error en la transacción:', error);
      message = '❌ ' + (error.message || 'Error al registrar la transacción. Por favor, intente nuevamente.');
      // desplazar al top para que el usuario vea el error
      try { if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    }
    loading = false;
  }

  function selectUser(user: { id: string; name: string }) {
    userId = user.id;
    userName = user.name;
    userSuggestions = []; // Limpiar las sugerencias después de seleccionar
    fetchBalance();
    // prepare amount input for typing
    quantity = '';
    // focus after DOM updates
    tick().then(() => quantityInput?.focus());
  }

  async function focusQuantity() {
    // ensure DOM updated
    await tick();
    if (quantityInput) {
      quantityInput.focus();
      // Select current content if any
      try { (quantityInput as HTMLInputElement).select(); } catch (e) { /* ignore */ }
    }
  }

  // Observadores reactivos actualizados
$: userSuggestions = userId
  ? allUsers.filter(u => u.id.startsWith(userId))
  : [];
$: {
  if (userId && allUsers.length > 0) {
    const user = allUsers.find(u => u.id === userId);
    userExists = !!user;
    userName = user ? user.name ?? '' : '';
    if (userExists) {
  fetchBalance();
  userSuggestions = []; // Asegurar que las sugerencias se limpien
  // Clear amount and focus it so user can type the monto inmediatamente
  quantity = '';
  focusQuantity();
    } else {
      currentBalance = null;
    }
  } else {
    userExists = false;
    userName = '';
    currentBalance = null;
  }
}
</script>

<svelte:head>
  <title>Recarga | {siteName}</title>
  <meta name="description" content="Recarga saldo para un usuario en el sistema" />
</svelte:head>

<div class="max-w-2xl mx-auto">
  <!-- Header -->
  <div class="text-center header-space">
    <h1 class="text-4xl font-bold text-[#35528C] mb-3 mt-3 font-sans s-xNGq_AHMpqrL">Recargar Saldo</h1>
    <p class="text-lg text-[#35528C]/80 font-sans max-w-2xl mx-auto s-WmfxB9smyTUP">Recarga saldo para un usuario en el sistema</p>
  </div>

  <!-- Step Content -->
  <div class="card glass-effect">
    {#if message}
      <div class="mb-6 p-4 rounded-lg {message.includes('Error') ? 'message-error' : 'message-success'} shadow-sm">
        <div class="flex items-center">
          <span class="text-2xl mr-3">{message.includes('Error') ? '❌' : '✅'}</span>
          <p class="text-lg font-medium">
            {message}
          </p>
        </div>
      </div>
    {/if}
    <form 
      on:submit|preventDefault={(e) => {
        // Prevenir el envío si el evento fue causado por la tecla Enter
        if (e.submitter === null) {
          e.preventDefault();
          return;
        }
        
        const exactMatch = allUsers.find(u => u.id === userId);
        if (exactMatch && userExists) {
          handleSubmit();
        } else if (userSuggestions.length > 1) {
          alert('Hay más de un usuario que coincide, selecciona uno de la lista de sugerencias.');
        } else {
          alert('No existe un usuario con ese ID');
        }
      }} 
      class="space-y-6"
    >
        <div>
          <label for="userId" class="block text-sm font-medium text-gray-700 mb-2">
            ID de Usuario
          </label>
          <div class="flex items-center gap-2">
            <input 
              id="userId"
              type="tel" 
              bind:value={userId} 
              required 
              class="input-field"
              on:keydown={(e) => {
                // Permitir Ctrl+C, Ctrl+V, Ctrl+A
                if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'a'].includes(e.key.toLowerCase())) {
                  return;
                }
                // Prevenir el envío del formulario al presionar Enter
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              placeholder="Ingrese ID del usuario"
            />
            <button type="button" class="h-10 w-10 p-1 rounded-lg flex items-center justify-center bg-[#35528C] text-white shadow-sm hover:bg-[#2A4170] focus:outline-none focus:ring-2 focus:ring-[#35528C]/40" aria-label="Abrir escáner" on:click={openScanner}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h3l2-2h6l2 2h3v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <circle cx="12" cy="13" r="3.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

      {#if userSuggestions.length > 0}
        <div>
          <label for="user-suggestions" class="block text-sm font-medium text-gray-700 mb-2">
            Sugerencias:
          </label>
          <div class="space-y-2">
            {#each userSuggestions as u}
              <button 
                type="button"
                on:click={() => selectUser(u)}
                class="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <span class="font-medium text-gray-900">ID: {u.id}</span>
                <span class="text-gray-600 ml-2">- {u.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if userExists}
        <div class="bg-gradient-to-br from-blue-50 to-blue-50/50 border border-blue-200/50 rounded-xl p-6 mb-6 shadow-sm">
          <div class="flex justify-between items-center">
            <div>
              <p class="text-blue-900/80 text-sm mb-1">Usuario</p>
              <p class="text-blue-900 text-lg font-semibold">{userName}</p>
            </div>
            <div class="text-right">
              <p class="text-blue-900/80 text-sm mb-1">Saldo actual</p>
              <p class="text-blue-900 text-2xl font-bold">{formatCurrency(currentBalance ?? 0)}</p>
            </div>
          </div>
        </div>
        
        <div>
          <label for="quantity" class="block text-sm font-medium text-gray-700 mb-2">
            Cantidad a recargar
          </label>
          <input 
            id="quantity" 
            type="number" 
            bind:value={quantity} 
            bind:this={quantityInput}
            required 
            class="input-field no-spinner" 
            step="1" 
            placeholder="$"
            inputmode="numeric"
            on:wheel={(e) => e.preventDefault()}
            on:keydown={(e) => {
              // Prevent arrow up/down from changing the value
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
              }
            }}
            on:input={(e) => {
              // Allow empty string to mean no value entered yet
              const value = e.currentTarget.value;
              if (value === '') {
                quantity = '';
                return;
              }
              // Permitir números negativos y enteros
              const num = Number(value);
              if (!Number.isNaN(num)) {
                quantity = Math.round(num);
                e.currentTarget.value = quantity.toString();
              } else {
                quantity = '';
              }
            }}
          />
          <p class="text-sm text-gray-500 mt-1">Ingrese un número positivo para recargar o negativo para descontar</p>
        </div>

        {#if Number(quantity) !== 0}
          {#if Number(quantity) > 0}
            <div>
              <label for="method" class="block text-sm font-medium text-gray-700 mb-2">
                Método de pago <span class="text-red-500">*</span>
              </label>
              <select id="method" bind:value={method} required class="input-field">
                <option value="">Selecciona método</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Otro">Otro</option>
              </select>
              {#if method === 'Otro'}
                <input type="text" bind:value={customMethod} required class="input-field mt-2" placeholder="Especifica el método de pago" />
              {/if}
            </div>
          {/if}
          
          <div>
            <label for="observations" class="block text-sm font-medium text-gray-700 mb-2">
              Observaciones {Number(quantity) < 0 ? '(Requerido)' : '(Opcional)'}
            </label>
            <textarea 
              id="observations"
              bind:value={observations} 
              required={Number(quantity) < 0} 
              class="input-field"
              rows="3"
              placeholder="Detalles adicionales sobre la transacción..."
            ></textarea>
          </div>

          <!-- Resumen de la transacción -->
          <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200/50 rounded-xl p-6 mb-6 shadow-sm">
            <h3 class="font-semibold text-gray-900 mb-4 text-lg">Resumen de la Transacción</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p class="text-sm text-gray-600 mb-1">Tipo</p>
                <p class="{Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'} text-lg font-semibold">
                  {Number(quantity) >= 0 ? '↗️ Recarga' : '↙️ Descuento'}
                </p>
              </div>
              <div class="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p class="text-sm text-gray-600 mb-1">Cantidad</p>
                <p class="{Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'} text-lg font-semibold">
                  {formatCurrency(Math.abs(Number(quantity)))}
                </p>
              </div>
              <div class="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p class="text-sm text-gray-600 mb-1">Nuevo saldo</p>
                <p class="text-blue-600 text-lg font-semibold">
                  {formatCurrency((currentBalance ?? 0) + Number(quantity))}
                </p>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={Number(quantity) > 0 ? (method === 'Otro' ? !customMethod.trim() : !method.trim()) : Number(quantity) < 0 ? !observations.trim() : false} 
            class="btn-primary w-full"
          >
            {#if loading}
              <span class="inline-flex items-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </span>
            {:else}
              <span style="color:white">Confirmar Transacción</span>
            {/if}
          </button>
        {/if}
      {:else if userId && !allUsers.some(u => u.id === userId)}
        <div class="text-center py-8">
          <span class="text-6xl">⚠️</span>
          <h3 class="text-lg font-medium text-red-900 mt-4">Usuario no encontrado</h3>
          <p class="text-red-700 mt-2">No existe un usuario con el ID: {userId}</p>
        </div>
      {/if}
    </form>
  </div>

  {#if showScanner && ScannerComponent}
    <svelte:component this={ScannerComponent} on:scanned={handleScannerScanned} on:status={handleScannerStatus} on:error={handleScannerError} on:close={closeScanner} />
  {/if}
</div>

<style>
  :global(body) {
    background: linear-gradient(135deg, #f6f8ff 0%, #ffffff 100%);
  }
  
  .header-space {
    margin-bottom: 2.5rem;
  }
  
  .section-title-center {
    font-size: 2.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #35528C 0%, #4668a5 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 0.5rem;
    font-family: 'Nunito', ui-sans-serif, system-ui, sans-serif;
    letter-spacing: -0.5px;
    text-align: center;
    text-shadow: 0 2px 10px rgba(53, 82, 140, 0.1);
  }
  
  .btn-primary {
    background: linear-gradient(135deg, #35528C 0%, #4668a5 100%) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 2px 8px rgba(53, 82, 140, 0.13) !important;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
  }
  
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(53, 82, 140, 0.25) !important;
  }
  
  .btn-primary:active {
    transform: translateY(0);
  }
  
  .btn-primary::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
    transition: opacity 0.3s;
    opacity: 0;
  }
  
  .btn-primary:hover::after {
    opacity: 1;
  }
  
  .btn-primary:disabled,
  button:disabled {
    background: #e2e5e9 !important;
    color: #a0a6b0 !important;
    cursor: not-allowed !important;
    transform: none !important;
    box-shadow: none !important;
  }
  

  
  .input-field {
    width: 100%;
    padding: 0.875rem 1.25rem;
    border-radius: 0.75rem;
    border: 2px solid #e5e7eb;
    font-size: 1rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    color: #1f2937;
  }
  
  .input-field:focus {
    border-color: #35528C;
    box-shadow: 0 2px 12px rgba(53, 82, 140, 0.15);
    outline: none;
    transform: translateY(-1px);
  }
  
  .input-field::placeholder {
    color: #9ca3af;
  }
  
  /* Remove spinners from number input */
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
  
  .glass-effect {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-radius: 1.5rem;
    box-shadow: 
      0 4px 24px -1px rgba(53, 82, 140, 0.1),
      0 2px 8px -1px rgba(53, 82, 140, 0.06);
    border: 1px solid rgba(53, 82, 140, 0.08);
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .glass-effect {
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Estilos para los mensajes de éxito/error */
  .message-success {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: rgb(21, 128, 61);
  }
  
  .message-error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: rgb(185, 28, 28);
  }
  
  /* Transiciones suaves para todos los elementos interactivos */
  button, input, textarea {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
</style>

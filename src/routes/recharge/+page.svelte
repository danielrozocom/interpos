<script lang="ts">
  import { onMount } from 'svelte';
  import { siteName } from '../../lib/config';
  // MoneyA  async function fetchBalance() {per request

  let userId = '';
  let userName = '';
  let quantity: number = 0;
  let method = '';
  let customMethod = '';
  let observations = '';
  let message = '';
  let loading = false;
  let currentBalance: number | null = null;
  let userExists: boolean = false;
  let allUsers: Array<{id: string, name: string}> = [];
  let userSuggestions: Array<{id: string, name: string}> = [];

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
    userId = numericOnly;
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
      // Esperar un momento antes de limpiar el mensaje
      setTimeout(() => {
        message = '';
      }, 3000);
    } catch (error: any) {
      console.error('Error en la transacción:', error);
      message = '❌ ' + (error.message || 'Error al registrar la transacción. Por favor, intente nuevamente.');
    }
    loading = false;
  }

  // Observadores reactivos actualizados
  $: if (userId) {
    fetchBalance();
    updateSuggestions();
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
        <input 
          id="userId"
          type="tel" 
          bind:value={userId} 
          required 
          class="input-field"
          autofocus
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
                on:click={() => {
                  userId = u.id;
                  // Eliminamos el auto-submit
                  const found = allUsers.find(x => x.id === u.id);
                  if (found) {
                    userExists = true;
                  }
                }}
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
            required 
            class="input-field" 
            step="1" 
            placeholder="0.00"
            on:input={(e) => {
              // Permitir números negativos y enteros
              const value = e.currentTarget.value;
              if (value) {
                quantity = Math.round(Number(value));
                e.currentTarget.value = quantity.toString();
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
                <option value="QR Redeban">QR Redeban</option>
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

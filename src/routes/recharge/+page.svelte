<script lang="ts">
import { rechargeBalance } from '$lib/recharge';
import { onMount } from 'svelte';
import { siteName } from '../../lib/config';

let userId = '';
let userName = '';
let quantity: number = 0;
let method = '';
let observations = '';
let message = '';
let loading = false;
let currentBalance: number | null = null;
let userExists: boolean = false;
let step = 1;
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];

let stepsCompleted = {
  1: false,
  2: false,
  3: false,
  4: false
};

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
  return `$${isNaN(val) ? 0 : Math.round(val).toLocaleString('es-MX')}`;
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

function validateStep(targetStep: number): boolean {
  if (targetStep < step) return true; // Siempre permitir retroceder
  
  switch (targetStep) {
    case 2:
      return allUsers.some(u => u.id === userId);
    case 3:
      return userExists && !isNaN(Number(quantity)) && Number(quantity) !== 0;
    case 4:
      // Para ir al paso 4, validamos que:
      // 1. El usuario exista y la cantidad sea válida
      if (!userExists || isNaN(Number(quantity)) || Number(quantity) === 0) return false;
      // 2. Si es recarga positiva, debe tener método de pago
      if (Number(quantity) > 0) return method.trim() !== '';
      // 3. Si es cantidad negativa, debe tener observaciones
      if (Number(quantity) < 0) return observations.trim() !== '';
      return true;
    default:
      return false;
  }
}

function moveToStep(targetStep: number) {
  if (targetStep < step || validateStep(targetStep)) {
    step = targetStep;
    updateAllSteps();
  }
}

function updateAllSteps() {
  stepsCompleted[1] = allUsers.some(u => u.id === userId);
  stepsCompleted[2] = userExists && !isNaN(Number(quantity)) && Number(quantity) !== 0;
  stepsCompleted[3] = (Number(quantity) > 0 ? method.trim() !== '' : true) && 
                     (Number(quantity) < 0 ? observations.trim() !== '' : true);
  stepsCompleted[4] = validateStep(4);
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
    
    // Realizar las operaciones en orden con mejor manejo de errores
    try {
      await rechargeBalance({ userId, quantity, newBalance, method, observations });
    } catch (error) {
      throw new Error('Error al registrar la recarga: ' + (error.message || 'Error desconocido'));
    }
    
    try {
      await updateUserBalance(userId, newBalance);
    } catch (error) {
      throw new Error('Error al actualizar el saldo: ' + (error.message || 'Error desconocido'));
    }

    // Mostrar mensaje de éxito y limpiar el formulario
    const successMessage = 'Transacción completada con éxito';
    
    // Primero limpiar todos los campos
    userId = '';
    userName = '';
    quantity = 0;
    method = '';
    observations = '';
    currentBalance = null;
    userExists = false;
    userSuggestions = [];
    
    // Actualizar estados
    updateAllSteps();
    
    // Cambiar al paso 1
    step = 1;
    
    // Mostrar el mensaje después de limpiar todo
    message = successMessage;
    
    // Esperar un momento antes de limpiar el mensaje
    setTimeout(() => {
      message = '';
    }, 3000);
  } catch (error) {
    console.error('Error en la transacción:', error);
    message = '❌ ' + (error.message || 'Error al registrar la transacción. Por favor, intente nuevamente.');
  }
  loading = false;
}

function getStepStyle(stepNumber: number): string {
  if (stepsCompleted[stepNumber] && step > stepNumber) {
    return 'step-completed';
  } else if (step === stepNumber) {
    return 'step-active';
  }
  return 'step-inactive';
}

// Observadores reactivos actualizados
$: if (userId) {
  fetchBalance();
  updateSuggestions();
  updateAllSteps();
}
$: if (quantity !== undefined) {
  updateAllSteps();
}
$: if (method || observations) {
  updateAllSteps();
}
</script>

<svelte:head>
  <title>Recarga | {siteName}</title>
  <meta name="description" content="Recarga saldo para un usuario en el sistema" />
</svelte:head>

<div class="max-w-2xl mx-auto">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-[#35528C] mb-2">Recargar Saldo</h1>
    <p class="text-[#35528C]/80">Añadir fondos a la cuenta de un usuario</p>
  </div>

  <!-- Progress Indicator -->
  <div class="flex justify-center mb-8">
    <div class="flex items-center space-x-4">
      <div class="flex items-center">
        <button
          type="button"
          class="step-indicator {getStepStyle(1)}"
          on:click={() => moveToStep(1)}
          aria-label="Ir al paso 1"
        >{stepsCompleted[1] && step > 1 ? '✔' : '1'}</button>
        <span class="ml-2 text-sm font-medium" style="color:#35528C">Usuario</span>
      </div>
      <div class="w-8 border-t" style="border-color: {stepsCompleted[1] ? '#35528C' : '#e5e7eb'}"></div>
      <div class="flex items-center">
        <button
          type="button"
          class="step-indicator {getStepStyle(2)}"
          on:click={() => moveToStep(2)}
          disabled={!validateStep(2) && step < 2}
          aria-label="Ir al paso 2"
        >{stepsCompleted[2] && step > 2 ? '✔' : '2'}</button>
        <span class="ml-2 text-sm font-medium" style="color:#35528C">Cantidad</span>
      </div>
      <div class="w-8 border-t" style="border-color: {stepsCompleted[2] ? '#35528C' : '#e5e7eb'}"></div>
      <div class="flex items-center">
        <button
          type="button"
          class="step-indicator {getStepStyle(3)}"
          on:click={() => moveToStep(3)}
          disabled={!validateStep(3) && step < 3}
          aria-label="Ir al paso 3"
        >{stepsCompleted[3] && step > 3 ? '✔' : '3'}</button>
        <span class="ml-2 text-sm font-medium" style="color:#35528C">Detalles</span>
      </div>
      <div class="w-8 border-t" style="border-color: {stepsCompleted[3] ? '#35528C' : '#e5e7eb'}"></div>
      <div class="flex items-center">
        <button
          type="button"
          class="step-indicator {getStepStyle(4)}"
          on:click={() => moveToStep(4)}
          disabled={!validateStep(4) && step < 4}
          aria-label="Ir al paso 4"
        >{stepsCompleted[4] && step > 4 ? '✔' : '4'}</button>
        <span class="ml-2 text-sm font-medium" style="color:#35528C">Confirmar</span>
      </div>
    </div>
  </div>

  <!-- Step Content -->
  <div class="card">
    {#if step === 1}
      {#if message}
        <div class="mb-6 p-4 {message.includes('Error') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'} rounded-lg">
          <div class="flex items-center">
            <span class="text-xl mr-3">{message.includes('Error') ? '❌' : '✅'}</span>
            <p class="{message.includes('Error') ? 'text-red-800' : 'text-green-800'} text-lg font-medium">
              {message}
            </p>
          </div>
        </div>
      {/if}
      
      <h2 class="text-xl font-semibold text-[#35528C] mb-6">Seleccionar Usuario</h2>
      <form on:submit|preventDefault={() => {
        if (allUsers.some(u => u.id === userId)) {
          step = 2;
        }
      }} class="space-y-6">
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
            on:keydown={(e) => {
              validateNumericInput(e);
              if (e.key === 'Enter') {
                if (allUsers.some(u => u.id === userId)) {
                  step = 2;
                  e.preventDefault();
                } else {
                  alert('No existe un usuario con ese ID');
                  e.preventDefault();
                }
              }
            }}
            on:paste={cleanPastedValue}
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
                  on:click={() => { userId = u.id; step = 2; }}
                  class="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <span class="font-medium text-gray-900">ID: {u.id}</span>
                  <span class="text-gray-600 ml-2">- {u.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <button type="submit" disabled={!allUsers.some(u => u.id === userId)} class="btn-primary w-full">
          <span style="color:white">Continuar</span>
        </button>
      </form>
    {/if}

    {#if step === 2}
      {#if userExists}
        <h2 class="text-xl font-semibold text-gray-900 mb-6">Información del Usuario</h2>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p class="text-blue-900"><strong>Usuario:</strong> {userName}</p>
          <p class="text-blue-900"><strong>Saldo actual:</strong> <span class="font-bold">{formatCurrency(currentBalance ?? 0)}</span></p>
        </div>
        
        <form on:submit|preventDefault={() => { step = 3; }} class="space-y-6">
          <div>
            <label for="quantity" class="block text-sm font-medium text-gray-700 mb-2">
              Cantidad a recargar
            </label>
            <input id="quantity" type="number" bind:value={quantity} required class="input-field" step="0.01" placeholder="0.00" />
            <p class="text-sm text-gray-500 mt-1">Ingrese un número positivo para recargar o negativo para descontar</p>
          </div>
          
          <div class="flex space-x-4">
            <button type="submit" disabled={isNaN(Number(quantity)) || Number(quantity) === 0} class="btn-primary flex-1">
              <span style="color:white">Continuar</span>
            </button>
            <button type="button" on:click={() => moveToStep(1)} class="btn-secondary">
              <span style="color:white">Volver</span>
            </button>
          </div>
        </form>
      {:else}
        {#if userId && !allUsers.some(u => u.id === userId)}
          <div class="text-center py-8">
            <span class="text-6xl">⚠️</span>
            <h3 class="text-lg font-medium text-red-900 mt-4">Usuario no encontrado</h3>
            <p class="text-red-700 mt-2">No existe un usuario con el ID: {userId}</p>
            <button on:click={() => { step = 1; }} class="btn-primary mt-4">
              Volver
            </button>
          </div>
        {/if}
      {/if}
    {/if}

    {#if step === 3}
      <h2 class="text-xl font-semibold text-gray-900 mb-6">Detalles de la Transacción</h2>
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 space-y-2">
        <p><strong>Usuario:</strong> {userName}</p>
        <p><strong>Saldo actual:</strong> {formatCurrency(currentBalance ?? 0)}</p>
        <p><strong>Cantidad:</strong> <span class="{Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'} font-bold">{formatCurrency(Number(quantity))}</span></p>
        <p><strong>Nuevo saldo:</strong> <span class="font-bold text-blue-600">{formatCurrency((currentBalance ?? 0) + (isNaN(Number(quantity)) ? 0 : Number(quantity)))}</span></p>
      </div>
      
      <form on:submit|preventDefault={() => { step = 4; }} class="space-y-6">
        {#if Number(quantity) > 0}
          <div>
            <label for="method" class="block text-sm font-medium text-gray-700 mb-2">
              Método de pago <span class="text-red-500">*</span>
            </label>
            <input id="method" type="text" bind:value={method} required class="input-field" placeholder="Efectivo, Transferencia, Tarjeta, etc." />
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
        
        <div class="flex space-x-4">
          <button 
            type="submit" 
            disabled={Number(quantity) > 0 ? !method.trim() : Number(quantity) < 0 ? !observations.trim() : false} 
            class="btn-primary flex-1"
          >
            <span style="color:white">Continuar</span>
          </button>
          <button type="button" on:click={() => moveToStep(2)} class="btn-secondary">
            <span style="color:white">Volver</span>
          </button>
        </div>
      </form>
    {/if}

    {#if step === 4}
      <h2 class="text-xl font-semibold text-gray-900 mb-6">Confirmar Transacción</h2>
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div class="flex">
          <span class="text-yellow-600 text-xl mr-3">⚠️</span>
          <div>
            <h3 class="text-yellow-800 font-medium">Revisar antes de confirmar</h3>
            <p class="text-yellow-700 text-sm">Esta acción no se puede deshacer. Verifique que todos los datos sean correctos.</p>
          </div>
        </div>
      </div>
      
      <!-- Resumen de la transacción -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
        <div class="border-b pb-2">
          <h3 class="font-medium text-gray-900 mb-1">Datos del Usuario</h3>
          <div class="space-y-1">
            <p><strong>ID:</strong> {userId || '—'}</p>
            <p><strong>Nombre:</strong> {userName || '—'}</p>
            <p><strong>Saldo actual:</strong> <span class="font-medium">{formatCurrency(currentBalance ?? 0)}</span></p>
          </div>
        </div>
        
        <div class="border-b pb-2">
          <h3 class="font-medium text-gray-900 mb-1">Detalles de la Transacción</h3>
          <div class="space-y-1">
            <p>
              <strong>Tipo:</strong> 
              <span class="{Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                {Number(quantity) >= 0 ? 'Recarga' : 'Descuento'}
              </span>
            </p>
            <p>
              <strong>Cantidad:</strong> 
              <span class="{Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                {formatCurrency(Math.abs(Number(quantity)))}
              </span>
            </p>
            <p>
              <strong>Nuevo saldo:</strong> 
              <span class="text-blue-600 font-medium">
                {formatCurrency((currentBalance ?? 0) + Number(quantity))}
              </span>
            </p>
          </div>
        </div>

        <div>
          <h3 class="font-medium text-gray-900 mb-1">Información Adicional</h3>
          <div class="space-y-1">
            {#if Number(quantity) > 0}
              <p><strong>Método de pago:</strong> {method || '—'}</p>
            {/if}              <p><strong>Observaciones:</strong> {observations || '—'}</p>
          </div>
        </div>
      </div>

      {#if message}
        <div class="mt-6 p-4 {message.includes('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'} rounded-lg">
          <div class="flex items-center">
            <span class="text-xl mr-3">{message.includes('✅') ? '✅' : '❌'}</span>
            <p class="{message.includes('✅') ? 'text-green-800' : 'text-red-800'} text-lg font-medium">
              {message}
            </p>
          </div>
        </div>
      {/if}

      <div class="mt-6 flex space-x-4">
        <button
          type="button"
          on:click={handleSubmit}
          disabled={loading}
          class="btn-primary flex-1"
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
            Confirmar Transacción
          {/if}
        </button>
        <button type="button" on:click={() => moveToStep(3)} class="btn-secondary" disabled={loading}>
          Volver
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .btn-primary {
    background-color: #35528C !important;
    color: white !important;
    border: 1px solid #35528C !important;
    box-shadow: none !important;
  }
  .btn-secondary {
    background-color: #35528C !important;
    color: white !important;
    border: 1px solid #35528C !important;
    box-shadow: none !important;
    opacity: 0.7;
  }
  .step-indicator {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.25rem;
    transition: all 0.2s;
    margin: 0;
    padding: 0;
  }
  .step-indicator:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .step-completed {
    background-color: #35528C !important;
    color: white !important;
    border: 1.5px solid #35528C !important;
  }
  .step-active {
    background-color: white !important;
    color: #35528C !important;
    border: 2.5px solid #35528C !important;
    font-weight: bold;
    box-shadow: 0 0 0 2px #35528C22;
  }
  .step-inactive {
    background-color: #e5e7eb !important;
    color: #6b7280 !important;
    border: 1.5px solid #e5e7eb !important;
  }
</style>

<script lang="ts">
import { rechargeBalance } from '$lib/recharge';
import { onMount } from 'svelte';

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
    allUsers = await res.json();
  } catch {
    allUsers = [];
  }
}

onMount(fetchAllUsers);

function updateSuggestions() {
  if (!userId) {
    userSuggestions = [];
    return;
  }
  userSuggestions = allUsers.filter(u => u.id.includes(userId));
}

async function fetchBalance() {
  if (!userId) {
    currentBalance = null;
    return;
  }
  try {
    const res = await fetch('/api/sheets/users');
    const users = await res.json();
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      userExists = true;
      userName = user.name ?? '';
      let balance = user.balance !== undefined && user.balance !== '' && !isNaN(Number(user.balance)) ? Number(user.balance) : 0;
      currentBalance = balance;
    } else {
      userExists = false;
      userName = '';
      currentBalance = null;
    }
  } catch {
    currentBalance = null;
  }
}

$: userId, updateSuggestions();
$: userId, step === 2 && fetchBalance();

async function updateUserBalance(userId: string, newBalance: number) {
  await fetch('/api/sheets/users/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newBalance })
  });
}

async function handleSubmit() {
  loading = true;
  message = '';
  try {
    const oldBalance = currentBalance ?? 0;
    const newBalance = oldBalance + Number(quantity);
    await rechargeBalance({ userId, quantity, newBalance, method, observations });
    await updateUserBalance(userId, newBalance);
    message = `El usuario ${userName} (${userId}) tenía ${formatCurrency(oldBalance)} y ahora tiene ${formatCurrency(newBalance)}.`;
    // Limpiar campos
    userId = '';
    userName = '';
    quantity = 0;
    method = '';
    observations = '';
    currentBalance = null;
    step = 1;
  } catch (error) {
    message = 'Error al registrar la recarga.';
  }
  loading = false;
}
</script>

<svelte:head>
  <title>Recargar Saldo - InterPOS</title>
</svelte:head>

<div class="max-w-2xl mx-auto">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Recargar Saldo</h1>
    <p class="text-gray-600">Añadir fondos a la cuenta de un usuario</p>
  </div>

  <!-- Progress Indicator -->
  <div class="flex justify-center mb-8">
    <div class="flex items-center space-x-4">
      <div class="flex items-center">
        <div class="step-indicator {step >= 1 ? 'step-active' : 'step-inactive'}">1</div>
        <span class="ml-2 text-sm font-medium text-gray-600">Usuario</span>
      </div>
      <div class="w-8 border-t border-gray-300"></div>
      <div class="flex items-center">
        <div class="step-indicator {step >= 2 ? (step === 2 ? 'step-active' : 'step-completed') : 'step-inactive'}">2</div>
        <span class="ml-2 text-sm font-medium text-gray-600">Cantidad</span>
      </div>
      <div class="w-8 border-t border-gray-300"></div>
      <div class="flex items-center">
        <div class="step-indicator {step >= 3 ? (step === 3 ? 'step-active' : 'step-completed') : 'step-inactive'}">3</div>
        <span class="ml-2 text-sm font-medium text-gray-600">Detalles</span>
      </div>
      <div class="w-8 border-t border-gray-300"></div>
      <div class="flex items-center">
        <div class="step-indicator {step === 4 ? 'step-active' : 'step-inactive'}">4</div>
        <span class="ml-2 text-sm font-medium text-gray-600">Confirmar</span>
      </div>
    </div>
  </div>

  <!-- Step Content -->
  <div class="card">{#if step === 1}
    <h2 class="text-xl font-semibold text-gray-900 mb-6">Seleccionar Usuario</h2>
    <form on:submit|preventDefault={() => {
      if (allUsers.some(u => u.id === userId)) {
        step = 2;
      }
    }} class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          ID de Usuario
        </label>
        <input 
          type="tel" 
          bind:value={userId} 
          required 
          list="user-suggestions" 
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
        <datalist id="user-suggestions">
          {#each userSuggestions as u}
            <option value={u.id}>{u.name}</option>
          {/each}
        </datalist>
      </div>

      {#if userSuggestions.length > 0}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
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
        Continuar
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
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Cantidad a recargar
          </label>
          <input type="number" bind:value={quantity} required class="input-field" step="0.01" placeholder="0.00" />
          <p class="text-sm text-gray-500 mt-1">Ingrese un número positivo para recargar o negativo para descontar</p>
        </div>
        
        <div class="flex space-x-4">
          <button type="submit" disabled={isNaN(Number(quantity)) || Number(quantity) === 0} class="btn-primary flex-1">
            Continuar
          </button>
          <button type="button" on:click={() => { step = 1; }} class="btn-secondary">
            Volver
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
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Método de pago <span class="text-red-500">*</span>
          </label>
          <input type="text" bind:value={method} required class="input-field" placeholder="Efectivo, Transferencia, Tarjeta, etc." />
        </div>
      {/if}
      
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Observaciones {Number(quantity) < 0 ? '(Requerido)' : '(Opcional)'}
        </label>
        <textarea 
          bind:value={observations} 
          required={Number(quantity) < 0} 
          class="input-field"
          rows="3"
          placeholder="Detalles adicionales sobre la transacción..."
        ></textarea>
      </div>
      
      <div class="flex space-x-4">
        <button type="submit" disabled={Number(quantity) > 0 ? !method : false} class="btn-primary flex-1">
          Continuar
        </button>
        <button type="button" on:click={() => { step = 2; }} class="btn-secondary">
          Volver
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
    
    <div class="space-y-4 mb-6">
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-gray-50 p-3 rounded-lg">
          <p class="text-sm text-gray-600">Usuario</p>
          <p class="font-bold text-gray-900">{userName}</p>
        </div>
        <div class="bg-gray-50 p-3 rounded-lg">
          <p class="text-sm text-gray-600">ID</p>
          <p class="font-bold text-gray-900">{userId}</p>
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-blue-50 p-3 rounded-lg">
          <p class="text-sm text-blue-600">Saldo anterior</p>
          <p class="font-bold text-blue-900">{formatCurrency(currentBalance ?? 0)}</p>
        </div>
        <div class="bg-green-50 p-3 rounded-lg">
          <p class="text-sm text-green-600">Nuevo saldo</p>
          <p class="font-bold text-green-900">{formatCurrency((currentBalance ?? 0) + (isNaN(Number(quantity)) ? 0 : Number(quantity)))}</p>
        </div>
      </div>
      
      <div class="bg-gray-50 p-3 rounded-lg">
        <p class="text-sm text-gray-600">Cantidad</p>
        <p class="font-bold {Number(quantity) >= 0 ? 'text-green-600' : 'text-red-600'}">{formatCurrency(Number(quantity))}</p>
      </div>
      
      {#if Number(quantity) > 0}
        <div class="bg-gray-50 p-3 rounded-lg">
          <p class="text-sm text-gray-600">Método</p>
          <p class="font-bold text-gray-900">{method}</p>
        </div>
      {/if}
      
      <div class="bg-gray-50 p-3 rounded-lg">
        <p class="text-sm text-gray-600">Observaciones</p>
        <p class="text-gray-900">{observations || 'Sin observaciones'}</p>
      </div>
    </div>
    
    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <button type="submit" disabled={loading} class="btn-primary w-full">
        {#if loading}
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Procesando...
          </div>
        {:else}
          Confirmar y Registrar
        {/if}
      </button>
      <button type="button" on:click={() => { step = 3; }} disabled={loading} class="btn-secondary w-full">
        Volver
      </button>
    </form>
  {/if}

  {#if message}
    <div class="mt-6 p-4 {message.includes('Error') ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'} rounded-lg">
      <div class="flex">
        <span class="text-xl mr-3">{message.includes('Error') ? '❌' : '✅'}</span>
        <p class="{message.includes('Error') ? 'text-red-800' : 'text-green-800'}">{message}</p>
      </div>
    </div>
  {/if}
</div>
</div>

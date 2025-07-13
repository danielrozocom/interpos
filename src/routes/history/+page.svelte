<script lang="ts">
import { onMount } from 'svelte';

let userId = '';
let userName = '';
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];
let transactions: Array<any> = [];
let loading = false;
let error = '';
let step = 1;

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

function cleanNumber(str: string | number): number {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Elimina $ y comas, conserva el signo
  return Number(str.replace(/[^\d.-]/g, ''));
}

function formatCurrency(val: number): string {
  return `$${isNaN(val) ? 0 : Math.round(val).toLocaleString('es-MX')}`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
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

async function fetchTransactions() {
  loading = true;
  error = '';
  transactions = [];
  try {
    const res = await fetch(`/api/sheets/history?userId=${userId}`);
    if (!res.ok) throw new Error('No se pudo obtener el historial');
    transactions = await res.json();
    const user = allUsers.find(u => u.id === userId);
    userName = user ? user.name : '';
    step = 2;
  } catch (e) {
    error = 'Error al consultar el historial.';
  }
  loading = false;
}

$: userId, updateSuggestions();

</script>

<svelte:head>
  <title>Historial - InterPOS</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-2">Historial de Transacciones</h1>
    <p class="text-gray-600">Consultar el historial de movimientos de un usuario</p>
  </div>

  <div class="card">
    {#if step === 1}
      <h2 class="text-xl font-semibold text-gray-900 mb-6">Seleccionar Usuario</h2>
      <form on:submit|preventDefault={fetchTransactions} class="space-y-6">
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
                  fetchTransactions();
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
                  on:click={() => { userId = u.id; fetchTransactions(); }}
                  class="w-full text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <span class="font-medium text-gray-900">ID: {u.id}</span>
                  <span class="text-gray-600 ml-2">- {u.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <button 
          type="submit" 
          disabled={loading || !allUsers.some(u => u.id === userId)} 
          class="btn-primary w-full"
        >
          {#if loading}
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Consultando...
            </div>
          {:else}
            Consultar Historial
          {/if}
        </button>
      </form>
    {/if}

    {#if step === 2}
      <div class="space-y-6">
        <!-- User Info Header -->
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Historial de {userName}</h2>
            <p class="text-gray-600">ID: {userId}</p>
          </div>
          <button on:click={() => { step = 1; userId = ''; userName = ''; transactions = []; }} class="btn-secondary">
            Nuevo Usuario
          </button>
        </div>

        {#if error}
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex">
              <span class="text-red-600 text-xl mr-3">❌</span>
              <p class="text-red-800">{error}</p>
            </div>
          </div>
        {:else if transactions.length === 0}
          <div class="text-center py-12">
            <span class="text-6xl">📋</span>
            <h3 class="text-lg font-medium text-gray-900 mt-4">Sin transacciones</h3>
            <p class="text-gray-500 mt-2">Este usuario no tiene transacciones registradas.</p>
          </div>
        {:else}
          <!-- Transactions Table -->
          <div class="overflow-hidden border border-gray-200 rounded-lg">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Anterior</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nuevo Saldo</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each transactions as transaction}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.Date)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <span class="{cleanNumber(transaction.Quantity) >= 0 ? 'text-green-600' : 'text-red-600'}">
                          {formatCurrency(cleanNumber(transaction.Quantity))}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(cleanNumber(transaction.PrevBalance))}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {formatCurrency(cleanNumber(transaction.NewBalance))}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.Method || '-'}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={transaction["Observation(s)"]}>
                        {transaction["Observation(s)"] || '-'}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Summary -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 class="text-lg font-medium text-blue-900 mb-2">Resumen</h3>
            <p class="text-blue-800">Total de transacciones: <strong>{transactions.length}</strong></p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

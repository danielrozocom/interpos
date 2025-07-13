<script lang="ts">
import { onMount } from 'svelte';
import { siteName } from '../../lib/config';

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
  // Mostrar solo usuarios cuyo ID empieza exactamente con el texto ingresado
  userSuggestions = allUsers.filter(u => u.id.startsWith(userId));
}

async function fetchTransactions() {
  loading = true;
  error = '';
  transactions = [];
  try {
    const res = await fetch(`/api/sheets/history?userId=${userId}`);
    if (!res.ok) throw new Error('No se pudo obtener el historial');
    let data = await res.json();
    // Ordenar por fecha descendente (más reciente primero)
    transactions = data.sort((a: any, b: any) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
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
  <title>Historial de Transacciones | {siteName}</title>
  <meta name="description" content="Consultar el historial de movimientos de un usuario" />
</svelte:head>

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
</style>

<div class="max-w-4xl mx-auto">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-3xl font-bold text-[#35528C] mb-2 text-center">Historial de Transacciones</h1>
    <p class="text-[#35528C]/80 text-center">Consultar el historial de movimientos de un usuario</p>
  </div>

  {#if step === 1}
    <div class="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-8 mb-8 border border-[#35528C]">
      <h2 class="text-xl font-semibold text-[#35528C] mb-6 text-left font-sans">Seleccionar Usuario</h2>
      <form on:submit|preventDefault={fetchTransactions} class="space-y-6">
        <div>
          <label for="userId" class="block text-sm font-medium text-gray-700 mb-2">ID de Usuario</label>
          <input 
            id="userId"
            type="tel"
            bind:value={userId}
            required
            class="mt-1 block w-full rounded-lg border-2 focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C] border-[#35528C]/30 bg-white px-4 py-2 text-gray-900 placeholder-[#35528C]/60 font-sans transition-all duration-150 shadow-sm sm:text-base"
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
        </div> <!-- Properly closed input wrapper div -->

        {#if userSuggestions.length > 0}
          <div>
            <label for="suggestions" class="block text-sm font-medium text-gray-700 mb-2">Sugerencias:</label>
            <div class="space-y-2">
              {#each userSuggestions as u}
                <button 
                  type="button"
                  on:click={() => { userId = u.id; fetchTransactions(); }}
                  class="w-full text-left p-3 border border-[#35528C]/30 rounded-lg hover:bg-[#35528C]/10 transition-colors duration-200 font-sans placeholder-[#35528C]/60"
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
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#35528C] py-2 px-6 text-base font-semibold text-white shadow hover:bg-[#27406B] focus:outline-none focus:ring-2 focus:ring-[#35528C] focus:ring-offset-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed w-full font-sans tracking-wide"
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
    </div>
  {/if}

  {#if step === 2}
    <div class="space-y-6">
      <!-- User Info Header -->
      <div class="flex items-center justify-between">
        <div class="text-left">
          <h2 class="text-xl font-semibold text-[#35528C]">Historial de {userName}</h2>
          <p class="text-[#35528C]/80">ID: {userId}</p>
        </div>
        <button 
          on:click={() => { step = 1; userId = ''; userName = ''; transactions = []; }} 
          class="btn-secondary px-4 py-2 rounded-lg text-white font-medium hover:opacity-80 transition-opacity"
        >
          Nueva consulta
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
        <div class="bg-white shadow-xl rounded-xl overflow-hidden border w-full mb-8" style="border-color:#35528C">
          <div class="mt-2 overflow-x-auto">
            <table class="min-w-full divide-y" style="border-color:#35528C">
              <thead class="bg-[#35528C]/10">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Cantidad</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Saldo Anterior</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Nuevo Saldo</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Método</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Observaciones</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y" style="border-color:#35528C">
                {#each transactions as transaction}
                  <tr class="hover:bg-[#35528C]/10 transition-colors duration-100">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.Date)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span class="{cleanNumber(transaction.Quantity) >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}">
                        {formatCurrency(cleanNumber(transaction.Quantity))}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(cleanNumber(transaction.PrevBalance))}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {formatCurrency(cleanNumber(transaction.NewBalance))}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" style="color:#35528C">
                      {transaction.Method || '-'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={transaction["Observation(s)"]}>
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

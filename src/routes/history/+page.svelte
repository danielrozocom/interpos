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
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }
  .btn-primary {
    background-color: #35528C !important;
    color: white !important;
    border: 1px solid #35528C !important;
    box-shadow: 0 2px 8px #35528C22 !important;
    font-weight: 600;
    transition: all 0.2s;
  }
  .btn-primary:hover {
    background-color: #2A4170 !important;
    box-shadow: 0 4px 16px #35528C33 !important;
  }
  .btn-secondary {
    background-color: #35528C !important;
    color: white !important;
    border: 1px solid #35528C !important;
    box-shadow: none !important;
    opacity: 0.7;
    font-weight: 600;
  }
  .btn-primary:disabled, .btn-secondary:disabled, button:disabled {
    background-color: #c4c8cf !important;
    color: #fff !important;
    cursor: not-allowed !important;
    opacity: 1 !important;
    border-color: #c4c8cf !important;
    box-shadow: none !important;
  }
</style>

<div class="min-h-screen bg-gray-50 p-4">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-8 animate-fadeIn">
      <h1 class="text-4xl font-bold text-[#35528C] mb-3 font-sans">Historial de Transacciones</h1>
      <p class="text-lg text-[#35528C]/80 font-sans max-w-2xl mx-auto">Consulta el historial de movimientos de un usuario</p>
    </div>

    {#if step === 1}
      <div class="bg-white rounded-2xl shadow-lg border border-[#35528C]/10 p-8 mb-8 transform transition-all duration-200 hover:shadow-xl animate-fadeIn">
        <h2 class="text-xl font-semibold text-[#35528C] mb-6 text-left font-sans">Seleccionar Usuario</h2>
        <form on:submit|preventDefault={fetchTransactions} class="space-y-6">
          <div>
            <label for="userId" class="block text-lg font-semibold text-[#35528C] mb-3">ID de Usuario</label>
            <input 
              id="userId"
              type="tel"
              bind:value={userId}
              required
              class="flex-1 h-12 rounded-xl border-2 border-gray-200 shadow-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20 text-lg px-4 font-sans"
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
          </div>

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
            class="btn-primary inline-flex items-center justify-center gap-2 rounded-xl py-3 px-8 text-lg font-semibold shadow hover:bg-[#2A4170] focus:outline-none focus:ring-2 focus:ring-[#35528C] focus:ring-offset-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed w-full font-sans tracking-wide"
          >
            {#if loading}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Consultando...
              </span>
            {:else}
              Consultar Historial
            {/if}
          </button>
        </form>
      </div>
    {/if}

    {#if step === 2}
      <div class="space-y-8 animate-fadeIn">
        <div class="flex items-center justify-between mb-4">
          <div class="text-left">
            <h2 class="text-xl font-semibold text-[#35528C]">Historial de {userName}</h2>
            <p class="text-[#35528C]/80">ID: {userId}</p>
          </div>
          <button 
            on:click={() => { step = 1; userId = ''; userName = ''; transactions = []; }} 
            class="btn-primary px-4 py-2 rounded-xl text-white font-medium hover:bg-[#2A4170] transition-opacity"
          >
            Nueva consulta
          </button>
        </div>

        {#if error}
          <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <p class="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        {:else if transactions.length === 0}
          <div class="text-center py-12">
            <span class="text-6xl">📋</span>
            <h3 class="text-lg font-medium text-gray-900 mt-4">Sin transacciones</h3>
            <p class="text-gray-500 mt-2">Este usuario no tiene transacciones registradas.</p>
          </div>
        {:else}
          <div class="bg-white rounded-2xl shadow-lg border border-[#35528C]/10 overflow-hidden">
            <div class="p-6 border-b border-gray-100">
              <h3 class="text-xl font-semibold text-[#35528C]">Últimos Movimientos</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-[#35528C]/5">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Fecha</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Cantidad</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Saldo Anterior</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Nuevo Saldo</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Método</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Observaciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each transactions as transaction}
                    <tr class="hover:bg-[#35528C]/5 transition-colors duration-150">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
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

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h3 class="text-lg font-medium text-blue-900 mb-2">Resumen</h3>
            <p class="text-blue-800">Total de transacciones: <strong>{transactions.length}</strong></p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
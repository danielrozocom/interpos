<script lang="ts">
import { onMount } from 'svelte';
import { siteName, formatDate } from '../../lib/config';

let userId = '';
let userName = '';
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];
let transactions: Array<any> = [];
let loading = false;
let error = '';
let step = 1;
let dateFrom = '';
let dateTo = '';
let transactionType = 'all'; // 'all', 'positive', 'negative'
let currentPage = 1;
let itemsPerPage = 15; // Valor por defecto

// Filtros computados
$: filteredTransactions = transactions
  .filter(t => {
    // Filtro por tipo de transacción
    if (transactionType === 'positive') return cleanNumber(t.Quantity) > 0;
    if (transactionType === 'negative') return cleanNumber(t.Quantity) < 0;
    return true;
  })
  .filter(t => {
    // Filtro por fecha
    const date = new Date(t.Date);
    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;

      // Ajustar la fecha "hasta" al final del día
      if (to) {
        to.setHours(23, 59, 59, 999);
      }

      if (from && to) {
        return new Date(date) >= from && new Date(date) <= to;
      }
      if (from) return new Date(date) >= from;
      if (to) return new Date(date) <= to;
    }
    return true;
  });

$: totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

$: if (currentPage > totalPages) {
  currentPage = totalPages > 0 ? totalPages : 1;
}

$: paginatedTransactions = filteredTransactions.slice(
  (currentPage - 1) * itemsPerPage,
  currentPage * itemsPerPage
);

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
  // No limpiar transactions aquí para evitar el flash
  try {
    const res = await fetch(`/api/sheets/history?userId=${userId}`);
    if (!res.ok) throw new Error('No se pudo obtener el historial');
    let data = await res.json();
    // Ordenar por fecha descendente (más reciente primero)
    transactions = data
      .sort((a: any, b: any) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
    const user = allUsers.find(u => u.id === userId);
    userName = user ? user.name : '';
    step = 2;
  } catch (e) {
    error = 'Error al consultar el historial.';
    // Solo limpiar transacciones si hay error
    transactions = [];
  }
  loading = false;
}

$: userId, updateSuggestions();

// Manual refresh function
async function refreshTransactions() {
  if (step === 2 && userId) {
    await fetchTransactions();
  }
}

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
      <h1 class="text-4xl font-bold text-[#35528C] mb-3 font-sans s-xNGq_AHMpqrL">Historial de Transacciones</h1>
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
              autofocus
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
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-4">
          <div class="text-left mb-4 md:mb-0">
            <h2 class="text-xl font-semibold text-[#35528C]">Historial de {userName}</h2>
            <p class="text-[#35528C]/80">ID: {userId}</p>
          </div>
          <!-- Botones debajo del título en móviles -->
          <div class="flex flex-row justify-center items-center gap-3">
            <button 
              on:click={refreshTransactions}
              disabled={loading}
              class="btn-primary px-4 py-2 rounded-xl text-white font-medium hover:bg-[#2A4170] transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <svg class="w-4 h-4" class:animate-spin={loading} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Actualizando...' : 'Actualizar'}
            </button>
            <button 
              on:click={() => { 
                step = 1; 
                userId = ''; 
                userName = ''; 
                transactions = []; 
                error = '';
                currentPage = 1;
              }} 
              class="btn-primary px-4 py-2 rounded-xl text-white font-medium hover:bg-[#2A4170] transition-opacity"
            >
              Nueva consulta
            </button>
          </div>
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
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Filtro por fecha -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha desde:</label>
                  <input 
                    type="date" 
                    bind:value={dateFrom}
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Fecha hasta:</label>
                  <input 
                    type="date" 
                    bind:value={dateTo}
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <!-- Filtro por tipo -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de transacción:</label>
                  <select 
                    bind:value={transactionType}
                    class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">Todas</option>
                    <option value="positive">Recargas</option>
                    <option value="negative">Consumos</option>
                  </select>
                </div>
              </div>
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
                  {#each paginatedTransactions as transaction}
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
                        {#if transaction["Observation(s)"] && transaction["Observation(s)"].includes('Compra #')}
                          {@const orderNumber = transaction["Observation(s)"].match(/Compra #(\d+)/)?.[1]}
                          {#if orderNumber}
                            <a href={`/voucher/${orderNumber}`} target="_blank" class="text-blue-600 underline hover:text-blue-800">
                              {transaction["Observation(s)"]}
                            </a>
                          {:else}
                            {transaction["Observation(s)"] || '-'}
                          {/if}
                        {:else}
                          {transaction["Observation(s)"] || '-'}
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Nueva sección: Información y selección de ítems por página -->
            <div class="flex flex-col md:flex-row justify-between items-center p-6 border-t border-gray-100">
              <p class="text-sm text-gray-700 mb-2 md:mb-0">
                Mostrando {paginatedTransactions.length} de {filteredTransactions.length} transacciones
              </p>
              <div class="flex items-center gap-2">
                <label for="itemsPerPage" class="text-sm text-gray-700">Transacciones por página:</label>
                <select 
                  id="itemsPerPage" 
                  bind:value={itemsPerPage} 
                  class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>
          <!-- Paginación única -->
          {#if totalPages > 1}
            <div class="flex justify-center mt-4 gap-2">
              <button 
                class="px-3 py-1 rounded border {currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50 text-[#35528C]'}"
                on:click={() => currentPage = Math.max(1, currentPage - 1)}
                disabled={currentPage === 1}
              >
                <span>&larr;</span>
              </button>
              
              {#each Array(Math.min(5, totalPages)) as _, i}
                {@const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i}
                {#if pageNum <= totalPages}
                  <button 
                    class="px-3 py-1 rounded border {currentPage === pageNum ? 'bg-[#35528C] text-white' : 'bg-white hover:bg-gray-50 text-[#35528C]'}"
                    on:click={() => currentPage = pageNum}
                  >
                    {pageNum}
                  </button>
                {/if}
              {/each}
              
              <button 
                class="px-3 py-1 rounded border {currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50 text-[#35528C]'}"
                on:click={() => currentPage = Math.min(totalPages, currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span>&rarr;</span>
              </button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>
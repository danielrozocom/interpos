<script lang="ts">
import { onMount } from 'svelte';
import { siteName } from '../../lib/config';
// Ya no necesitamos formatDateOnly y formatTimeOnly porque vienen del servidor
// import { formatDateOnly, formatTimeOnly } from '../../lib/date-utils';

let userId = '';
let userName = '';
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];
let transactions: Array<any> = [];

let error = '';
let loading = false;
let step = 1;
let dateFrom = '';
let dateTo = '';
let transactionType = 'all'; // 'all', 'positive', 'negative'
let currentPage = 1;
let itemsPerPage = 15; // Valor por defecto

// Filtros computados con filtro de fechas funcional
$: filteredTransactions = (() => {
  if (transactions.length === 0) {
    return [];
  }
  
  const filtered = transactions.filter(t => {
    const quantity = cleanNumber(t.Quantity);
    
    // Filtro por tipo de transacción
    let typeMatch = true;
    if (transactionType === 'positive') typeMatch = quantity > 0;
    if (transactionType === 'negative') typeMatch = quantity < 0;
    
    // Filtro por fechas
    let dateMatch = true;
    if (dateFrom || dateTo) {
      // Convertir la fecha de la transacción a formato YYYY-MM-DD para comparar
      const transactionDate = t.Date; // Asumiendo que viene en formato YYYY-MM-DD desde el servidor
      
      if (dateFrom && transactionDate < dateFrom) {
        dateMatch = false;
      }
      if (dateTo && transactionDate > dateTo) {
        dateMatch = false;
      }
    }
    
    return typeMatch && dateMatch;
  });
  
  // Ordenar de más reciente a más vieja
  const sorted = filtered.sort((a, b) => {
    // Combinar fecha y hora para comparación completa
    const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
    const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
    
    // Ordenar descendente (más reciente primero)
    return dateTimeB.getTime() - dateTimeA.getTime();
  });
  
  return sorted;
})();

$: totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

$: if (currentPage > totalPages) {
  currentPage = totalPages > 0 ? totalPages : 1;
}

$: paginatedTransactions = (() => {
  const start = (currentPage - 1) * itemsPerPage;
  const end = currentPage * itemsPerPage;
  const paginated = filteredTransactions.slice(start, end);
  
  console.log('Paginación:', {
    currentPage,
    itemsPerPage,
    totalFiltered: filteredTransactions.length,
    start,
    end,
    paginatedLength: paginated.length,
    totalPages: Math.ceil(filteredTransactions.length / itemsPerPage)
  });
  
  return paginated;
})();

// Función para validar que solo se ingresen números en el ID
function validateNumericInput(event: KeyboardEvent) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (allowedKeys.includes(event.key)) {
    return;
  }
  if (!/[0-9]/.test(event.key)) {
    event.preventDefault();
  }
}

// Función para buscar usuarios y mostrar sugerencias
async function searchUsers(searchTerm: string) {
  // Limpiar sugerencias si no hay texto o es muy corto
  if (!searchTerm || searchTerm.trim().length < 2) {
    userSuggestions = [];
    return;
  }
  
  const cleanTerm = searchTerm.trim();
  
  // Solo buscar si hay al menos 2 caracteres
  if (cleanTerm.length < 2) {
    userSuggestions = [];
    return;
  }
  
  try {
    const response = await fetch(`/api/sheets/users?search=${encodeURIComponent(cleanTerm)}`);
    if (response.ok) {
      const data = await response.json();
      let users = [];
      
      if (Array.isArray(data.users)) {
        users = data.users;
      } else if (Array.isArray(data)) {
        users = data;
      }
      
      // Solo mostrar sugerencias si hay usuarios válidos
      if (!users || users.length === 0) {
        userSuggestions = [];
        return;
      }
      
      // Priorizar coincidencias exactas por ID, luego por nombre, luego parciales
      const exactId = users.filter((u: any) => u.id && u.id.toString() === cleanTerm);
      const exactName = users.filter((u: any) => u.name && u.name.toLowerCase() === cleanTerm.toLowerCase() && !exactId.includes(u));
      const startWithId = users.filter((u: any) => u.id && u.id.toString().startsWith(cleanTerm) && !exactId.includes(u));
      const startWithName = users.filter((u: any) => u.name && u.name.toLowerCase().startsWith(cleanTerm.toLowerCase()) && !exactName.includes(u) && !startWithId.includes(u));
      const partialName = users.filter((u: any) => u.name && u.name.toLowerCase().includes(cleanTerm.toLowerCase()) && !exactId.includes(u) && !exactName.includes(u) && !startWithId.includes(u) && !startWithName.includes(u));
      
      const filteredSuggestions = [...exactId, ...exactName, ...startWithId, ...startWithName, ...partialName].slice(0, 5);
      
      // Solo asignar si hay coincidencias reales
      userSuggestions = filteredSuggestions.length > 0 ? filteredSuggestions : [];
    } else {
      userSuggestions = [];
    }
  } catch (error) {
    console.error('Error buscando usuarios:', error);
    userSuggestions = [];
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

function parseCustomDate(dateTimeStr: string): Date {
  if (!dateTimeStr) {
    console.log('Missing DateTime:', { dateTimeStr });
    return new Date(0); // Fecha muy antigua si faltan datos
  }

  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) {
    console.log('Invalid ISO date:', dateTimeStr);
    return new Date(0);
  }

  console.log('Parsed ISO date:', { dateTimeStr, result: date });
  return date;
}

$: updateSuggestions();

// Manual refresh function

// Fetch transaction history for selected user
async function fetchTransactions() {
  if (!userId) {
    error = 'Por favor ingrese un ID de usuario válido';
    return;
  }
  loading = true;
  error = '';
  try {
    // Primero obtener el nombre del usuario
    try {
      const userRes = await fetch(`/api/sheets/users?userId=${encodeURIComponent(userId)}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        userName = userData.name || '';
      }
    } catch (userErr) {
      console.log('No se pudo obtener el nombre del usuario:', userErr);
    }

    // Luego obtener las transacciones
    const res = await fetch(`/api/sheets/history?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al consultar el historial');
    }
    const data = await res.json();
    transactions = data;
    
    // Si no obtuvimos el nombre del endpoint de usuarios, usar el de las transacciones
    if (!userName && data.length > 0 && data[0].Name) {
      userName = data[0].Name;
    }
    
    step = 2;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
      error = (err as any).message;
    } else {
      error = 'Error desconocido al consultar el historial';
    }
    transactions = [];
    userName = '';
  } finally {
    loading = false;
  }
}

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
  .btn-primary:disabled, button:disabled {
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
              autofocus
              class="flex-1 h-12 rounded-xl border-2 border-[#35528C] shadow-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20 text-lg px-4 font-sans"
              on:keydown={(e) => {
                validateNumericInput(e);
                if (e.key === 'Enter') {
                  if (userSuggestions.length > 0 && userSuggestions.some(u => u.id === userId)) {
                    fetchTransactions();
                    e.preventDefault();
                  } else if (userId.trim()) {
                    fetchTransactions();
                    e.preventDefault();
                  }
                }
              }}
              on:input={() => {
                // Limpiar sugerencias inmediatamente si el campo está vacío
                if (!userId || userId.trim().length === 0) {
                  userSuggestions = [];
                } else if (userId.trim().length >= 2) {
                  // Solo mostrar sugerencias si hay al menos 2 caracteres
                  searchUsers(userId);
                } else {
                  userSuggestions = [];
                }
              }}
              on:paste={cleanPastedValue}
              placeholder="Ingrese ID del usuario"
              autocomplete="off"
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
            <h2 class="text-xl font-semibold text-[#35528C]">Historial de {userName || 'Usuario'}</h2>
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
                userSuggestions = []; // Limpiar sugerencias de usuarios
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
              <div class="flex flex-col md:flex-row md:items-end gap-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                  <!-- Filtro por fecha -->
                  <div>
                    <label for="dateFrom" class="block text-sm font-medium text-gray-700 mb-1">Fecha desde:</label>
                    <input 
                      id="dateFrom"
                      type="date" 
                      bind:value={dateFrom}
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20"
                    />
                  </div>
                  <div>
                    <label for="dateTo" class="block text-sm font-medium text-gray-700 mb-1">Fecha hasta:</label>
                    <input 
                      id="dateTo"
                      type="date" 
                      bind:value={dateTo}
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20"
                    />
                  </div>
                  <!-- Filtro por tipo -->
                  <div>
                    <label for="transactionType" class="block text-sm font-medium text-gray-700 mb-1">Tipo de transacción:</label>
                    <select 
                      id="transactionType"
                      bind:value={transactionType}
                      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20"
                    >
                      <option value="all">Todas</option>
                      <option value="positive">Recargas</option>
                      <option value="negative">Consumos</option>
                    </select>
                  </div>
                </div>
                <!-- Botón para limpiar filtros -->
                <div class="flex gap-2">
                  <button 
                    type="button"
                    on:click={() => {
                      dateFrom = '';
                      dateTo = '';
                      transactionType = 'all';
                      currentPage = 1;
                    }}
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-sm font-medium"
                  >
                    Limpiar Filtros
                  </button>
                </div>
              </div>
            </div>
            {#if filteredTransactions.length === 0}
              <!-- Mensaje cuando no hay datos después del filtrado -->
              <div class="text-center py-12">
                <div class="mb-4">
                  <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron transacciones</h3>
                <p class="text-gray-500 mb-4">
                  {#if dateFrom || dateTo || transactionType !== 'all'}
                    No hay transacciones que coincidan con los filtros aplicados.
                  {:else}
                    Este usuario no tiene transacciones registradas.
                  {/if}
                </p>
                {#if dateFrom || dateTo || transactionType !== 'all'}
                  <button 
                    on:click={() => {
                      dateFrom = '';
                      dateTo = '';
                      transactionType = 'all';
                      currentPage = 1;
                    }}
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-[#35528C] bg-[#35528C]/10 hover:bg-[#35528C]/20 transition-colors duration-200"
                  >
                    <svg class="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Limpiar filtros
                  </button>
                {/if}
              </div>
            {:else}
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-[#35528C]/5">
                    <tr>
                      <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Fecha</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Hora</th>
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
                        {transaction.dateOnly || '-'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.timeOnly || '-'}
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
            {/if}
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
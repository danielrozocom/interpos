<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { siteName } from '../../lib/config';
import { tick } from 'svelte';
import { normalizeUserId } from '../../lib/normalizeUserId';
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
let showScanner = false;
let ScannerComponent: any = null;
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
    // Función para formatear la hora a HH:mm:ss antes de la comparación
    function formatTime(timeStr: string): string {
      if (!timeStr) return '00:00:00';
      const parts = timeStr.split(':');
      const hours = parts[0]?.padStart(2, '0') || '00';
      const minutes = parts[1]?.padStart(2, '0') || '00';
      const seconds = parts[2]?.padStart(2, '0') || '00';
      return `${hours}:${minutes}:${seconds}`;
    }
    
    // Combinar fecha y hora para comparación completa usando los campos correctos
    const dateTimeA = new Date(`${a.dateOnly}T${formatTime(a.timeOnly || '00:00:00')}`);
    const dateTimeB = new Date(`${b.dateOnly}T${formatTime(b.timeOnly || '00:00:00')}`);
    
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

// Handler that centralizes numeric validation and Enter behavior
function handleUserIdKeydown(e: KeyboardEvent) {
  // First enforce numeric-only keys
  validateNumericInput(e);

  // If Enter pressed, trigger search (if valid) and prevent default
  if (e.key === 'Enter') {
    // If a suggestion exactly matches, prefer it; otherwise if there's any input, search by it
    if (userSuggestions.length > 0 && userSuggestions.some(u => u.id === userId)) {
      fetchTransactions();
      e.preventDefault();
    } else if (userId && userId.trim()) {
      fetchTransactions();
      e.preventDefault();
    }
  }
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

async function handleScannerScanned(ev: CustomEvent) {
  const { userId: scannedId, raw } = ev.detail || {};
  if (scannedId) {
    userId = await normalizeUserId(scannedId);
    // limpiar sugerencias
    userSuggestions = [];
    // ejecutar la consulta como si se presionara Enter
    fetchTransactions();
    // cerrar modal
    closeScanner();
    // enfocar input
    tick().then(() => { const el = document.getElementById('userId') as HTMLInputElement | null; if (el) el.focus(); });
  } else if (raw) {
    // si no se pudo derivar un ID, colocar raw para inspección
    userId = await normalizeUserId(String(raw));
    userSuggestions = [];
    // mostrar mensaje
    error = 'Leído (sin ID válido)';
  }
}

function handleScannerStatus(ev: CustomEvent) {
  console.log('Scanner status', ev.detail);
}

function handleScannerError(ev: CustomEvent) {
  console.error('Scanner error', ev.detail);
  error = String(ev.detail || 'Error del escáner');
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
async function cleanPastedValue(event: ClipboardEvent) {
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text') || '';
  const numericOnly = pastedText.replace(/[^0-9]/g, '');
  userId = await normalizeUserId(numericOnly);
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

// Keyboard shortcuts (Ctrl-based)
function handleGlobalShortcut(ev: CustomEvent) {
  const action = ev.detail?.action;
  if (!action) return;

  if (action === 'submit') {
    fetchTransactions();
    return;
  }
  if (action === 'openScanner') {
    openScanner();
    return;
  }
  if (action === 'focusId') {
    const el = document.getElementById('userId') as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    }
    return;
  }
  if (action === 'clearId') {
    userId = '';
    userSuggestions = [];
    error = '';
    return;
  }
}

onMount(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('global-shortcut', handleGlobalShortcut as any);
  }
});

onDestroy(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('global-shortcut', handleGlobalShortcut as any);
  }
});

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
      // Normalize manual input before performing the lookup
      if (userId && String(userId).trim() !== '') {
        userId = await normalizeUserId(userId);
      }

    // Primero obtener el nombre del usuario
    try {
      const userRes = await fetch(`/api/sheets/users?userId=${encodeURIComponent(userId)}`);
      if (!userRes.ok) {
        let body: any = null;
        try { body = await userRes.json(); } catch (e) { /* ignore */ }
        const serverMsg = body?.error || body?.message || 'No existe un usuario con ese ID';
        console.warn('User not found or server error for userId', userId, serverMsg);
        // Keep the user on the search view (step 1) and show the error under the search box
        error = serverMsg;
        transactions = [];
        userName = '';
        loading = false;
        return;
      }
      const userData = await userRes.json();
      userName = userData.name || '';
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
    // Stay on the search view so the error appears under the search box
    step = 1;
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
    <div class="text-center mb-2 animate-fadeIn">
      <h1 class="text-4xl font-bold text-[#35528C] mb-1 font-sans s-xNGq_AHMpqrL">Historial de Transacciones</h1>
      <p class="text-lg text-[#35528C]/80 font-sans max-w-2xl mx-auto">Consulta el historial de movimientos de un usuario</p>
    </div>

    {#if step === 1}
  <div class="bg-white rounded-2xl shadow-lg border border-[#35528C]/10 p-4 mb-4 transform transition-all duration-200 hover:shadow-xl animate-fadeIn">
  <!-- Título removido por solicitud del usuario -->
        <form on:submit|preventDefault={fetchTransactions} class="space-y-6">
          <div>
            <label for="userId" class="block text-lg font-semibold text-[#35528C] mb-3">ID de Usuario</label>
            <div class="flex items-center gap-2 min-w-0 flex-nowrap">
              <input 
                id="userId"
                type="tel"
                inputmode="numeric"
                pattern="[0-9]*"
                bind:value={userId}
                required
                class="flex-1 min-w-0 h-12 rounded-xl border-2 border-[#35528C] shadow-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20 text-lg px-4 font-sans"
                on:keydown={handleUserIdKeydown}
                on:paste={cleanPastedValue}
                on:input={(e) => { 
                  // Sanitize to digits only
                  const v = e.currentTarget.value.replace(/[^0-9]/g, ''); 
                  if (v !== userId) userId = v;
                  // Clear any previous error as the user edits the input
                  error = '';
                  // Limpiar sugerencias inmediatamente si el campo está vacío
                  if (!v || v.trim().length === 0) {
                    userSuggestions = [];
                  } else if (v.trim().length >= 2) {
                    // Solo mostrar sugerencias si hay al menos 2 caracteres
                    searchUsers(v);
                  } else {
                    userSuggestions = [];
                  }
                }}
                placeholder="Ingrese ID del usuario"
                autocomplete="off"
                autofocus
              />
              <button type="button" class="h-10 w-10 p-1 rounded-lg flex items-center justify-center bg-[#35528C] text-white shadow-sm hover:bg-[#2A4170] focus:outline-none focus:ring-2 focus:ring-[#35528C]/40 flex-none shrink-0" aria-label="Abrir escáner" on:click={openScanner}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h3l2-2h6l2 2h3v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <circle cx="12" cy="13" r="3.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
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
      {#if error}
  <div class="max-w-4xl mx-auto mt-2 mb-4 transform animate-fadeIn">
          <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <p class="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    {#if showScanner && ScannerComponent}
      <svelte:component this={ScannerComponent} on:scanned={handleScannerScanned} on:status={handleScannerStatus} on:error={handleScannerError} on:close={closeScanner} />
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
              class="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium hover:bg-[#2A4170] transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke-linecap="round" stroke-linejoin="round" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              Nueva consulta
            </button>
          </div>
        </div>

        {#if error}
          <div class="max-w-xl mx-auto mb-4 transform animate-fadeIn">
            <div class="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
              <div class="flex items-center">
                <svg class="h-5 w-5 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <p class="text-red-700 font-medium">{error}</p>
              </div>
            </div>
          </div>
        {:else if transactions.length === 0}
          <div class="text-center py-3">
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
              <div class="text-center py-3">
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
                        {(() => {
                          // Función para formatear la hora a HH:mm:ss
                          function formatTime(timeStr: string): string {
                            if (!timeStr) return '00:00:00';
                            const parts = timeStr.split(':');
                            const hours = parts[0]?.padStart(2, '0') || '00';
                            const minutes = parts[1]?.padStart(2, '0') || '00';
                            const seconds = parts[2]?.padStart(2, '0') || '00';
                            return `${hours}:${minutes}:${seconds}`;
                          }
                          
                          return transaction.timeOnly ? formatTime(transaction.timeOnly) : '-';
                        })()}
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
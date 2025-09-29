<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { siteName } from '../../lib/config';

  // Types
  interface User {
    id: string;
    name: string;
    balance: number;
  }

  // State
  let users: User[] = [];
  let loading: boolean = true;
  let error: string = '';
  let searchTerm: string = '';
  let sortBy: 'id' | 'name' | 'balance' = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Computed
  $: filteredUsers = users.filter(user => 
    user.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  $: sortedUsers = filteredUsers.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'id':
        comparison = a.id.localeCompare(b.id);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'balance':
        comparison = a.balance - b.balance;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Functions
  function formatCurrency(amount: number): string {
    return `$${Math.floor(amount).toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }

  function getBalanceColor(balance: number): string {
    if (balance < 0) return 'text-red-600';
    if (balance === 0) return 'text-gray-500';
    return 'text-green-600';
  }

  function handleSort(column: 'id' | 'name' | 'balance') {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'asc';
    }
  }

  async function fetchUsers() {
    loading = true;
    error = '';
    
    try {
      const response = await fetch('/api/sheets/users');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudieron obtener los usuarios`);
      }
      
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Formato de respuesta inválido');
      }
      
      users = data.map((user: any) => ({
        id: String(user.id),
        name: user.name || 'Sin nombre',
        balance: typeof user.balance === 'number' ? user.balance : 0
      }));
      
    } catch (err: any) {
      console.error('Error fetching users:', err);
      error = err.message || 'Error al cargar los usuarios';
    } finally {
      loading = false;
    }
  }

  async function refreshUsers() {
    await fetchUsers();
  }
  // Modal state & functions (moved into top-level script to avoid duplicate <script>)
  let showUserModal = false;
  let editingUser: { id?: string; name?: string } | null = null;
  let modalName = '';
  let modalId = '';
  let savingUser = false;
  let saveSuccess = false;
  let saveErrors: string[] = [];
  let _bodyScrollY = 0;
  let searchInput: HTMLInputElement | null = null;

  function openUserModal(user: User | null = null) {
    if (user) {
      editingUser = user;
      modalName = user.name || '';
      modalId = user.id || '';
    } else {
      editingUser = null;
      modalName = '';
      modalId = '';
    }
    // reset save state when opening
    savingUser = false;
    saveSuccess = false;
  saveErrors = [];
    showUserModal = true;
    // prevent background scrolling while modal is open by fixing body position
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      _bodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${_bodyScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeUserModal() {
    showUserModal = false;
    // reset transient state
    savingUser = false;
    saveSuccess = false;
  saveErrors = [];
    // restore body scrolling and scroll position
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      // restore previous scroll
      try {
        window.scrollTo(0, _bodyScrollY || 0);
      } catch (e) {
        // ignore
      }
    }
  }

  onDestroy(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      try { window.scrollTo(0, _bodyScrollY || 0); } catch (e) {}
    }
  });

  async function submitUser() {
    // Validation: both ID and Name are required
    saveErrors = [];
    // Collect all validation errors
    if (!modalId || String(modalId).trim().length === 0) {
      saveErrors.push('El ID es obligatorio.');
    } else if (!/^\d+$/.test(String(modalId))) {
      // Only validate numeric if present
      saveErrors.push('El ID debe ser numérico.');
    }
    if (!modalName || String(modalName).trim().length === 0) {
      saveErrors.push('El nombre es obligatorio.');
    }

    if (saveErrors.length > 0) {
      return;
    }

    const payload = { id: modalId, name: modalName };
    savingUser = true;
    try {
      // If creating (not editing), check that ID does not already exist
        if (!editingUser) {
          const checkRes = await fetch(`/api/sheets/users?userId=${encodeURIComponent(String(modalId))}`);
          if (checkRes.ok) {
            const maybe = await checkRes.json().catch(() => null);
            if (maybe && !maybe.error) {
              if (maybe && (maybe.name || maybe.balance !== undefined)) {
                throw new Error('El ID ya existe. Usa otro ID o edita el usuario existente.');
              }
            }
          } else if (checkRes.status !== 404) {
            console.warn('Chequeo de existencia devolvió código', checkRes.status);
          }
        } else {
          // editing: if ID changed, ensure new ID is not used by another user
          if (String(modalId) !== String(editingUser.id)) {
            const checkRes = await fetch(`/api/sheets/users?userId=${encodeURIComponent(String(modalId))}`);
            if (checkRes.ok) {
              const maybe = await checkRes.json().catch(() => null);
              if (maybe && !maybe.error) {
                if (maybe && (maybe.name || maybe.balance !== undefined)) {
                  throw new Error('El nuevo ID ya pertenece a otro usuario. Elige otro ID.');
                }
              }
            } else if (checkRes.status !== 404) {
              console.warn('Chequeo de existencia devolvió código', checkRes.status);
            }
          }
        }

        const res = await fetch('/api/sheets/users/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, creating: editingUser ? false : true, originalId: editingUser ? editingUser.id : undefined }),
        });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const serverMsg = errData?.error || 'Error guardando usuario';
        // push server message into errors array for display
        saveErrors = [serverMsg];
        throw new Error(serverMsg);
      }

      // refresh list and show confirmation
      await fetchUsers();
      saveSuccess = true;

      // Keep the modal briefly to show confirmation, then close
      setTimeout(() => {
        closeUserModal();
      }, 900);
    } catch (err: any) {
      console.error('Error creating/updating user', err);
      if (!saveErrors || saveErrors.length === 0) {
        saveErrors = [err?.message || 'Error al guardar usuario'];
      }
    } finally {
      savingUser = false;
    }
  }

  onMount(fetchUsers);
</script>

<svelte:head>
  <title>Clientes | {siteName}</title>
  <meta name="description" content="Lista de todos los clientes y sus saldos" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-4xl font-bold text-[#35528C] mb-1 font-sans s-xAzoHdC_kP8W">Gestión de Clientes</h1>
    <p class="text-lg text-[#35528C]/80 font-sans max-w-3xl mx-auto s-xAzoHdC_kP8W">
      Administra todos los clientes del sistema y consulta sus saldos actuales
    </p>
  </div>

  <!-- Controls -->
  <div class="card glass-effect mb-6">
  <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <!-- Search -->
      <div class="w-full lg:flex-1 lg:max-w-md">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none search-icon">
            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            bind:this={searchInput}
            type="text"
            bind:value={searchTerm}
            placeholder="Buscar por ID o nombre..."
            class="input-field input-with-icon pr-10 s-xAzoHdC_kP8W"
          />
          {#if searchTerm}
            <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label="Limpiar búsqueda" on:click={() => { searchTerm = ''; searchInput?.focus(); }}>
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
      <!-- Add user button -->
      <div class="flex items-center gap-2 w-full lg:w-auto">
        <button class="btn-primary btn-add" on:click={() => openUserModal() } title="Agregar cliente" aria-label="Agregar cliente">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="ml-3 block sm:hidden">Agregar</span>
          <span class="ml-3 hidden sm:inline">Agregar cliente</span>
        </button>
      </div>

      <!-- Stats and Refresh -->
      <div class="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
        <!-- Stats -->
        <div class="flex items-center gap-4 sm:gap-6 text-sm">
          <div class="text-center">
            <div class="font-semibold text-[#35528C]">{users.length}</div>
            <div class="text-gray-600">Total clientes</div>
          </div>
          <div class="text-center">
            <div class="font-semibold text-green-600">{filteredUsers.filter(u => u.balance > 0).length}</div>
            <div class="text-gray-600">Con saldo</div>
          </div>
          <div class="text-center">
            <div class="font-semibold text-red-600">{filteredUsers.filter(u => u.balance < 0).length}</div>
            <div class="text-gray-600">En deuda</div>
          </div>
        </div>

        <!-- Refresh Button -->
        <button
          on:click={refreshUsers}
          disabled={loading}
          class="btn-secondary flex items-center gap-2 whitespace-nowrap"
        >
          <svg class="h-4 w-4 {loading ? 'animate-spin' : ''}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
      <div class="flex items-center">
        <svg class="h-5 w-5 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-red-700 font-medium">{error}</p>
      </div>
    </div>
  {/if}

  <!-- Users Table -->
  <div class="card glass-effect overflow-hidden">
    {#if loading}
      <div class="text-center py-12">
  <svg class="animate-spin h-8 w-8 text-[#35528C] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600">Cargando clientes...</p>
      </div>
    {:else if sortedUsers.length === 0}
      <div class="text-center py-12">
        <!-- magnifying glass icon for empty search results -->
        <svg class="h-14 w-14 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron clientes</h3>
        {#if searchTerm}
          <p class="text-gray-700 font-medium mb-1">No hay resultados para "{searchTerm}"</p>
          <p class="text-gray-600">Intenta con otros términos de búsqueda (ID o nombre).</p>
        {:else}
          <p class="text-gray-600">No hay clientes registrados en el sistema.</p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-white">
            <tr>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('id')}>
                <div class="flex items-center justify-start">
                  <span>ID Cliente</span>
                  <svg class="h-4 w-4 {sortBy === 'id' ? 'text-[#35528C]' : 'text-gray-400'}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortBy === 'id' && sortDirection === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                </div>
              </th>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('name')}>
                <div class="flex items-center justify-start">
                  <span>Nombre</span>
                  <svg class="h-4 w-4 {sortBy === 'name' ? 'text-[#35528C]' : 'text-gray-400'}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortBy === 'name' && sortDirection === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                </div>
              </th>
              <th class="table-header cursor-pointer text-right" on:click={() => handleSort('balance')}>
                <div class="flex items-center justify-end">
                  <span>Saldo</span>
                  <svg class="h-4 w-4 ml-2 {sortBy === 'balance' ? 'text-[#35528C]' : 'text-gray-400'}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortBy === 'balance' && sortDirection === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                </div>
              </th>
              <th class="table-header text-center">Estado</th>
              <th class="table-header text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each sortedUsers as user, index (user.id)}
              <tr class="hover:bg-gray-50 transition-colors duration-150 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                <td class="table-cell font-sans font-normal text-[#35528C]">
                  {user.id}
                </td>
                <td class="table-cell name-cell">
                  <div class="font-medium text-gray-900">{user.name}</div>
                </td>
                <td class="table-cell text-right">
                  <span class="font-bold text-lg {getBalanceColor(user.balance)}">
                    {formatCurrency(user.balance)}
                  </span>
                </td>
                <td class="table-cell status-cell">
                  {#if user.balance > 0}
                    <span class="status-badge status-positive">✓ Activo</span>
                  {:else if user.balance === 0}
                    <span class="status-badge status-neutral">○ Sin saldo</span>
                  {:else}
                    <span class="status-badge status-negative">⚠ Deuda</span>
                  {/if}
                </td>
                <td class="table-cell actions-cell">
                  <div class="flex items-center justify-center gap-2">
                    <a
                      href={`/recharge?userId=${user.id}`}
                      class="btn-sm btn-primary"
                      title="Recargar saldo"
                      aria-label="Recargar saldo"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </a>
                    <a
                      href={`/history?userId=${user.id}`}
                      class="btn-sm btn-primary"
                      title="Ver historial"
                      aria-label="Ver historial"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <!-- provided history SVG -->
                      <svg class="h-4 w-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10,9 9,9 8,9"></polyline>
                      </svg>
                    </a>
                    <!-- Edit user (clear pencil icon) -->
                    <button class="btn-sm btn-primary" title="Editar cliente" aria-label="Editar cliente" on:click={() => openUserModal(user)}>
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"></path>
                        <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Pagination info -->
  {#if !loading && sortedUsers.length > 0}
    <div class="pagination-info mt-4 text-center text-sm text-gray-600 s-xAzoHdC_kP8W">
      Mostrando {sortedUsers.length} de {users.length} clientes
      {#if searchTerm}
        • Filtrado por: "{searchTerm}"
      {/if}
    </div>
  {/if}
</div>

<!-- User modal (create / edit) -->
{#if showUserModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
    <div class="modal-content bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
        <h3 class="text-lg font-semibold mb-4">{editingUser ? 'Editar cliente' : 'Agregar cliente'}</h3>

  <label for="modalId" class="block text-sm text-gray-700">ID <span class="text-red-600">*</span></label>
  <input id="modalId" class="input-field mt-2 mb-3" bind:value={modalId} placeholder="Ej: 12345" required inputmode="numeric" pattern="\d*" title="Solo números" on:input={(e) => { modalId = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }} />
  {#if false}
    <!-- advisory removed per request -->
    <div class="text-sm text-gray-500 mb-3">Si cambias el ID, debe ser numérico y no puede coincidir con otro usuario existente.</div>
  {/if}

  <label for="modalName" class="block text-sm text-gray-700">Nombre <span class="text-red-600">*</span></label>
  <input id="modalName" class="input-field mt-2 mb-2" bind:value={modalName} placeholder="Nombre del cliente" required />

        {#if saveErrors && saveErrors.length > 0}
          <div class="mb-2 text-sm text-red-600">
            <ul class="list-disc list-inside">
              {#each saveErrors as e}
                <li>{e}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if saveSuccess}
          <div class="mb-2 text-sm text-green-600">
            {#if editingUser}
              Cliente actualizado con éxito.
            {:else}
              Cliente creado con éxito.
            {/if}
          </div>
        {/if}

        <div class="flex justify-end gap-2">
          <button class="btn-secondary" on:click={closeUserModal} disabled={savingUser}>Cancelar</button>
          <button class="btn-primary" on:click|preventDefault={submitUser} disabled={savingUser}>
            {#if savingUser}
              <svg class="h-4 w-4 animate-spin mr-2" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Guardando...
            {:else}
              {editingUser ? 'Guardar' : 'Crear'}
            {/if}
          </button>
        </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    background: linear-gradient(135deg, #f6f8ff 0%, #ffffff 100%);
  }

  .card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-radius: 1.5rem;
    box-shadow: 
      0 4px 24px -1px rgba(53, 82, 140, 0.1),
      0 2px 8px -1px rgba(53, 82, 140, 0.06);
    border: 1px solid rgba(53, 82, 140, 0.08);
    padding: 1.5rem;
  }

  .glass-effect {
    /* animation removed per request */
    animation: none;
  }

  @keyframes fadeIn {
    /* no-op keyframes to avoid runtime errors if referenced */
    from { opacity: 1; transform: none; }
    to { opacity: 1; transform: none; }
  }

  .input-field {
    width: 100%;
    /* base padding: slightly reduced left padding to avoid too much empty space */
    padding: 0.75rem 1rem 0.75rem 2.25rem;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    font-size: 0.875rem;
  /* transitions disabled */
  transition: none;
    background: white;
    color: #1f2937;
  }

  /* Use this class when the input has an icon positioned absolutely on the left
     it provides slightly more left padding but less than the previous global value */
  .input-with-icon {
    padding-left: 2.5rem; /* ~40px */
  }

  .input-field:focus {
    border-color: #35528C;
    box-shadow: none;
    outline: none;
  }

  /* clear button inside search input */
  .card .relative button[aria-label="Limpiar búsqueda"] {
    background: transparent;
    border: none;
    padding: 0.25rem;
  }

  /* Keep search icon visible and on top when the input is focused or active */
  .search-icon {
    z-index: 20;
    color: #9CA3AF; /* text-gray-400 */
    pointer-events: none; /* clicks pass through to the input */
    transition: none;
    opacity: 1;
  }

  /* when the input is focused, keep icon visible and slightly darker */
  .relative:focus-within .search-icon {
    color: #6B7280; /* slightly darker on focus */
    opacity: 1;
  }

  .btn-primary {
    background: #35528C; /* solid color instead of gradient */
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    transition: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary:hover {
    transform: none;
    box-shadow: none;
  }

  .btn-secondary {
    background: white;
    color: #35528C;
    border: 2px solid #35528C;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    transition: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-secondary:hover {
    background: white;
    color: #35528C;
    transform: none;
  }

  .btn-sm {
    padding: 0.375rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  /* Make action buttons in the table larger and easier to tap */
  .table-cell .btn-sm {
    padding: 0.45rem 0.5rem;
    min-width: 36px;
    min-height: 36px;
    border-radius: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .table-cell .btn-sm svg {
    width: 18px !important;
    height: 18px !important;
  }

  /* Bigger, touch-friendly add button */
  .btn-add {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  @media (max-width: 640px) {
    /* On mobile make the add button full width for easier tapping */
    .btn-add {
      width: 100%;
      justify-content: center;
      padding: 0.85rem 1rem;
    }
    /* Modal spacing on small screens so it doesn't touch edges */
    .modal-content {
      margin: 1rem;
      max-height: calc(100vh - 2rem);
      overflow: auto;
      border-radius: 0.75rem;
    }
    /* Larger icons on mobile for better touch targets (kept moderate) */
    .btn-primary svg,
    .btn-secondary svg,
    .btn-add svg,
    .btn-sm svg,
    .table-cell svg,
    .search-icon svg {
      width: 18px !important;
      height: 18px !important;
    }
    /* increase action button hit area on mobile */
    /* Action buttons: slightly smaller icons but still large enough to tap */
    .actions-cell .btn-sm svg {
      width: 16px !important;
      height: 16px !important;
    }
    .table-cell .btn-sm {
      min-width: 40px;
      min-height: 40px;
      padding: 0.45rem;
    }
    /* Slightly larger table icons */
    .table-cell .h-4,
    .table-cell .w-4 {
      width: 18px !important;
      height: 18px !important;
    }
    /* Make status badges a bit smaller on mobile to prevent layout overflow */
    .status-badge {
      min-width: 72px;
      padding: 0.3rem 0.45rem;
      font-size: 0.825rem;
    }
  }

  /* Inputs inside the modal should have smaller left padding so the text is closer
     to the input edge (avoids large empty left margin inside dialogs) */
  .modal-content .input-field {
    padding-left: 1rem;
  }

  .table-header {
    padding: 1rem;
    text-align: center; /* center header text by default */
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.75rem;
    user-select: none;
  }

  .table-header:hover {
    background: rgba(53, 82, 140, 0.05);
  }

  /* Ensure header inner content (label + icon) is centered and spaced */
  .table-header > div {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  /* For headers that semantically should align right, keep cells intact but center header label */
  .table-header.text-right > div {
    justify-content: flex-end;
  }
  .table-header.text-left > div {
    justify-content: flex-start;
  }

  .table-cell {
    padding: 1rem;
    white-space: nowrap;
    font-size: 0.875rem;
  }

  /* Uniform cell types */
  .name-cell {
    text-align: left;
    vertical-align: middle;
  }

  .status-cell {
    text-align: center;
    vertical-align: middle;
  }

  .actions-cell {
    text-align: center;
    vertical-align: middle;
  }

  /* Status badge styles */
  .status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* vertical padding kept small; control horizontal width so all badges match */
    padding: 0.35rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1;
    /* consistent width across statuses */
    min-width: 96px;
    max-width: 100%;
    white-space: nowrap;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-positive { background: #ecfdf5; color: #065f46; }
  .status-neutral { background: #f3f4f6; color: #374151; }
  .status-negative { background: #fff7f6; color: #7f1d1d; }

  /* Keep action buttons visually consistent */
  .actions-cell .btn-sm {
    background: linear-gradient(135deg, #35528C 0%, #4668a5 100%);
    color: white;
    border: none;
  }


  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Pagination/info spacing to separate from table */
  .pagination-info {
    margin-top: 1.25rem; /* slightly larger gap */
    padding-top: 0.25rem;
  }
  @media (max-width: 640px) { .pagination-info { margin-top: 1rem; font-size: 0.875rem; } }
</style>

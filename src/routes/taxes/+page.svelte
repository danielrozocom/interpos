<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  let taxes: any[] = [];
  let loading = true;
  let error = '';
  let searchTerm = '';
  let searchInput: HTMLInputElement | null = null;
  let sortBy: 'code' | 'name' | 'mode' | 'value' = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Modal state
  let showModal = false;
  let editing: any = null;
  let modalCode = '';
  let modalName = '';
  let modalMode: 'PERCENT' | 'AMOUNT' = 'PERCENT';
  // modalValueRaw is the string shown in the input (accepts '19', '19%', '0.19')
  let modalValue: number | '' = '';
  let modalValueRaw: string = '';
  let modalDescription = '';
  let saving = false;
  let saveErrors: string[] = [];
  let saveSuccess = false;
  let errorAlertEl: HTMLElement | null = null;
  // confirmation dialogs
  let showConfirmDelete = false;
  let deleteTarget: any = null;
  let showConfirmClose = false; // confirm discard changes
  let hasUnsavedChanges = false;
  let _bodyScrollY = 0;
  let modalEl: HTMLElement | null = null;
  let headerHeight = 0;
  let modalMaxHeight = 0;
  let modalTop = 0;

  $: filtered = taxes.filter(t =>
    t.code.toLowerCase().includes(String(searchTerm).toLowerCase()) ||
    t.name.toLowerCase().includes(String(searchTerm).toLowerCase())
  );

  $: sorted = filtered.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'code': comparison = String(a.code || '').localeCompare(String(b.code || '')); break;
      case 'name': comparison = String(a.name || '').localeCompare(String(b.name || '')); break;
      case 'mode': comparison = String(a.mode || '').localeCompare(String(b.mode || '')); break;
      case 'value': comparison = (Number(a.defaultValue) || 0) - (Number(b.defaultValue) || 0); break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    else { sortBy = column; sortDirection = 'asc'; }
  }

  async function fetchTaxes() {
    loading = true; error = '';
    try {
      const res = await fetch('/api/sheets/taxes');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      taxes = Array.isArray(data.taxes) ? data.taxes : [];
    } catch (e: any) {
      console.error('Error loading taxes', e);
      error = e.message || 'Error al cargar tipos de impuestos';
      taxes = [];
    } finally { loading = false; }
  }

  async function refreshTaxes() {
    await fetchTaxes();
  }

  function openModal(t: any | null = null) {
    editing = t;
    if (t) {
      modalCode = t.code || '';
      modalName = t.name || '';
      modalMode = t.mode === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
      // prepare display value: if mode is PERCENT, show percent like '19' (not 0.19)
      if (t.mode === 'PERCENT') {
        const val = typeof t.defaultValue === 'number' ? Number(t.defaultValue) : Number(t.defaultValue ?? 0);
        modalValueRaw = isNaN(val) ? '' : String((val * 100).toFixed(2)).replace(/\.?0+$/, '');
        modalValue = val;
      } else {
        modalValue = typeof t.defaultValue === 'number' ? t.defaultValue : Number(t.defaultValue ?? 0);
        modalValueRaw = modalValue === '' ? '' : String(modalValue);
      }
      modalDescription = t.description || '';
    } else {
      modalCode = '';
      modalName = '';
      modalMode = 'PERCENT';
  modalValue = '';
  modalValueRaw = '';
      modalDescription = '';
    }
    saveErrors = [];
    saveSuccess = false;
    showModal = true;
  hasUnsavedChanges = false;
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      // store current scroll position and add modal-open class (defined in src/app.css)
      _bodyScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      try {
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
      } catch (e) {}
    }
  }

  function closeModal() {
    // if there are unsaved changes, ask for confirmation
    if (hasUnsavedChanges) {
      showConfirmClose = true;
      return;
    }

    showModal = false; saving = false; saveSuccess = false; saveErrors = [];
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
      } catch (e) {}
      // restore previous scroll position (use a small timeout to allow layout to settle)
      try { setTimeout(() => { window.scrollTo(0, _bodyScrollY || 0); }, 0); } catch(e) {}
    }
  }

  async function submit() {
    saveErrors = [];
    if (!modalCode || String(modalCode).trim() === '') saveErrors.push('El código es obligatorio.');
    if (!modalName || String(modalName).trim() === '') saveErrors.push('El nombre es obligatorio.');
    // Validate modalValueRaw: accept '19', '19%', '0.19'
    if (!modalValueRaw || String(modalValueRaw).trim() === '') {
      saveErrors.push('El valor por defecto es obligatorio y numérico.');
    } else {
      // normalize
      const raw = String(modalValueRaw).trim();
      let numeric = NaN;
      try {
        if (raw.endsWith('%')) {
          numeric = parseFloat(raw.slice(0, -1).replace(',', '.')) / 100;
        } else {
          numeric = parseFloat(raw.replace(',', '.'));
          // If mode is PERCENT and user passed '19' (no %), interpret as percent -> 0.19
          if (modalMode === 'PERCENT' && numeric > 1) numeric = numeric / 100;
        }
      } catch (e) {
        numeric = NaN;
      }
      if (isNaN(numeric)) saveErrors.push('El valor por defecto no es numérico válido.');
      else modalValue = numeric;
    }
    if (!['PERCENT','AMOUNT'].includes(String(modalMode))) saveErrors.push('El modo debe ser PERCENT o AMOUNT.');
    if (saveErrors.length) {
      await tick();
      try { errorAlertEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      return;
    }

    saving = true;
    try {
  const payload: any = { code: modalCode, name: modalName, mode: modalMode, defaultValue: Number(modalValue ?? 0), description: modalDescription };
      if (editing && editing.id) payload.id = editing.id;
      if (!editing) payload.creating = true;
      const res = await fetch('/api/sheets/taxes/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error guardando tipo de impuesto');
      }
      await fetchTaxes();
      saveSuccess = true;
  hasUnsavedChanges = false;
      setTimeout(() => { closeModal(); }, 900);
    } catch (e: any) {
      console.error('Error saving tax', e);
      saveErrors = [e.message || 'Error al guardar'];
      await tick();
      try { errorAlertEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
    } finally { saving = false; }
  }

  async function deleteTax(t: any) {
    // show confirmation modal instead of blocking confirm()
    deleteTarget = t;
    showConfirmDelete = true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/sheets/taxes/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) throw new Error('Error al eliminar');
      await fetchTaxes();
    } catch (e) {
      // show a simple alert for now (same behavior as before)
      alert('No se pudo eliminar el tipo de impuesto');
    } finally {
      showConfirmDelete = false;
      deleteTarget = null;
    }
  }

  function cancelDelete() {
    showConfirmDelete = false;
    deleteTarget = null;
  }

  function confirmCloseDiscard() {
    showConfirmClose = false;
    hasUnsavedChanges = false;
    // perform actual close
    showModal = false; saving = false; saveSuccess = false; saveErrors = [];
    try { document.documentElement.classList.remove('modal-open'); document.body.classList.remove('modal-open'); } catch(e) {}
    try { setTimeout(() => { window.scrollTo(0, _bodyScrollY || 0); }, 0); } catch(e) {}
  }

  function cancelCloseDiscard() {
    showConfirmClose = false;
  }

  function updateModalLayout() {
    if (typeof window === 'undefined') return;
    const header = document.querySelector('header.topbar') as HTMLElement | null;
    headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 52;
    const gap = 16;
    const available = Math.max(200, window.innerHeight - (headerHeight + gap * 2));
    modalMaxHeight = available;
    if (showModal && modalEl) {
      // center the modal within the available area below the header
      const modalHeight = Math.min(modalEl.getBoundingClientRect().height, available);
      modalTop = headerHeight + gap + Math.max(0, Math.floor((available - modalHeight) / 2));
    }
  }

  function onResize() { updateModalLayout(); }

  if (typeof window !== 'undefined') {
    updateModalLayout();
    window.addEventListener('resize', onResize);
  }

  onDestroy(() => { if (typeof window !== 'undefined') window.removeEventListener('resize', onResize); });
  onMount(fetchTaxes);
</script>

<svelte:head>
  <title>Gestión de Impuestos | InterPOS</title>
</svelte:head>

<div class="max-w-6xl mx-auto p-4">
  <div class="mb-8 text-center">
    <h1 class="text-4xl font-bold text-[#35528C] mb-1">Gestión de Impuestos</h1>
    <p class="text-lg text-[#35528C]/80">Administra los tipos de impuestos usados en precios y facturación</p>
  </div>

  <div class="card glass-effect mb-6">
    <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <!-- Search -->
      <div class="w-full lg:flex-1 lg:max-w-md">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none search-icon">
            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input bind:this={searchInput} type="text" bind:value={searchTerm} placeholder="Buscar por código o nombre..." class="input-field input-with-icon pr-10" />
          {#if searchTerm}
            <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label="Limpiar búsqueda" on:click={() => { searchTerm = ''; try { searchInput?.focus({ preventScroll: true }); } catch(e) { searchInput?.focus(); } }}>
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          {/if}
        </div>
      </div>

      <!-- Add button -->
      <div class="flex items-center gap-2 w-auto lg:w-auto mr-auto">
        <div class="flex items-center gap-3">
          <button type="button" class="inline-flex items-center justify-center p-3 rounded-full" on:click={() => openModal(null)} title="Agregar tipo de impuesto" aria-label="Agregar tipo de impuesto" style="background-color: #35528C; color: white;">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: white"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          </button>

          <button type="button" class="inline-flex items-center justify-center p-3 rounded-full" on:click={refreshTaxes} title="Sincronizar" aria-label="Sincronizar" style="background-color: #35528C; color: white;">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: white"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <!-- Stats and Refresh -->
      <div class="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
        <div class="mx-auto text-center flex flex-col items-center gap-0 sm:gap-1 text-sm leading-tight">
          <div class="font-semibold text-[#35528C] text-sm">{taxes.length}</div>
          <div class="text-gray-600 text-sm">Total tipos de impuestos</div>
        </div>
      </div>
    </div>
  </div>

  {#if error}
    <div class="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
      <div class="flex items-center">
        <svg class="h-5 w-5 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p class="text-red-700 font-medium">{error}</p>
      </div>
    </div>
  {/if}

  <div class="card glass-effect overflow-hidden">
    {#if loading}
      <div class="text-center py-12"><svg class="animate-spin h-8 w-8 text-[#35528C] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="text-gray-600">Cargando impuestos...</p></div>
    {:else if sorted.length === 0}
      <div class="text-center py-12">
        <svg class="h-14 w-14 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron tipos de impuestos</h3>
        {#if searchTerm}
          <p class="text-gray-700 font-medium mb-1">No hay resultados para "{searchTerm}"</p>
        {:else}
          <p class="text-gray-600">Aún no hay tipos de impuestos registrados.</p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-white">
            <tr>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('code')}>
                <div class="flex items-center justify-start"><span>Código</span></div>
              </th>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('name')}>
                <div class="flex items-center justify-start"><span>Nombre</span></div>
              </th>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('mode')}>
                <div class="flex items-center justify-start"><span>Tipo</span></div>
              </th>
              <th class="table-header cursor-pointer text-right" on:click={() => handleSort('value')}>
                <div class="flex items-center justify-end"><span>Valor</span></div>
              </th>
              <th class="table-header text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
              {#each sorted as t, index (t.id)}
              <tr class="hover:bg-gray-50 transition-colors duration-150 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}" class:row-selected={editing && editing.id === t.id}>
                <td class="table-cell font-sans font-normal text-[#35528C]">{t.code}</td>
                <td class="table-cell name-cell"><div class="font-medium text-gray-900">{t.name}</div><div class="text-sm text-gray-600">{t.description}</div></td>
                <td class="table-cell">{t.mode === 'PERCENT' ? 'Porcentaje' : 'Fijo'}</td>
                <td class="table-cell text-right">{t.mode === 'PERCENT' ? `${(Number(t.defaultValue) * 100).toFixed(2)}%` : `$${Number(t.defaultValue).toLocaleString('es-CO')}`}</td>
                <td class="table-cell text-center">
                  <div class="flex items-center justify-center gap-2">
                    <button class="btn-sm btn-primary" title="Editar producto" aria-label="Editar producto" on:click={() => openModal(t)}>
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"></path><path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>
                    </button>
                    <button
                      type="button"
                      title="Eliminar tipo"
                      aria-label="Eliminar tipo"
                      on:click={() => deleteTax(t)}
                      class="btn-sm inline-flex items-center justify-center p-2 rounded"
                      style="background-color: #35528C; color: white;"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: white"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
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

  {#if showModal}
    <!-- Wrapper with high z-index so modal sits above header (header z-index:1000) -->
    <div class="fixed inset-0 flex items-center justify-center p-4" style="z-index:2000">
      <div class="fixed inset-0 bg-black/40" on:click={closeModal} aria-hidden="true" style="z-index:2000"></div>
      <div bind:this={modalEl} class="relative w-full max-w-xl bg-white rounded-lg shadow-lg modal-content" style="z-index:2001">
        <div class="p-6 flex flex-col" style="max-height: {modalMaxHeight}px">
          <div class="overflow-auto pr-2" style="max-height: {modalMaxHeight - 80}px">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">{editing ? 'Editar tipo de impuesto' : 'Nuevo tipo de impuesto'}</h3>

            {#if saveSuccess}
              <div class="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div class="flex items-center space-x-2">
                  <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span class="text-sm font-medium text-green-800">{editing ? 'Se actualizó correctamente' : 'Se guardó correctamente'}</span>
                </div>
              </div>
            {/if}

            <!-- saveErrors will be shown near the footer so it's visible after validation -->

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label for="tax-code" class="block text-sm font-medium text-gray-700">Código <span class="text-red-600">*</span></label>
                <input id="tax-code" class="input-field mt-2 mb-3 w-full" required aria-required="true" type="text" bind:value={modalCode} on:input={() => { hasUnsavedChanges = true; }} />
              </div>
              <div>
                <label for="tax-name" class="block text-sm font-medium text-gray-700">Nombre <span class="text-red-600">*</span></label>
                <input id="tax-name" class="input-field mt-2 mb-3 w-full" required aria-required="true" type="text" bind:value={modalName} on:input={() => { hasUnsavedChanges = true; }} />
              </div>
              <div>
                <label for="tax-mode" class="block text-sm font-medium text-gray-700">Modo <span class="text-red-600">*</span></label>
                <select id="tax-mode" bind:value={modalMode} class="input-field mt-2 mb-3 w-full" on:change={() => { hasUnsavedChanges = true; }}>
                  <option value="PERCENT">Porcentaje (%)</option>
                  <option value="AMOUNT">Monto fijo</option>
                </select>
              </div>
              <div>
                <label for="tax-value" class="block text-sm font-medium text-gray-700">Valor por defecto <span class="text-red-600">*</span></label>
                <input id="tax-value" class="input-field mt-2 mb-3 w-full" required aria-required="true" type="number" inputmode="numeric" pattern="\d*(?:[\.,]\d+)?" bind:value={modalValueRaw} on:input={() => { hasUnsavedChanges = true; }} />
                <p class="text-sm text-gray-500 mt-1">{modalMode === 'PERCENT' ? 'Ingrese porcentaje como número entero (ej: 19)' : 'Ingrese monto entero (ej: 300)'}.</p>
              </div>
              <div>
                <label for="tax-desc" class="block text-sm font-medium text-gray-700">Descripción (opcional)</label>
                <textarea id="tax-desc" bind:value={modalDescription} class="input-field mt-2 mb-3 w-full" rows="3" on:input={() => { hasUnsavedChanges = true; }}></textarea>
              </div>
            </div>
          </div>

          <!-- required field hints shown at the bottom of the modal -->
          <div class="mt-4 p-3 bg-gray-50 border border-gray-100 rounded text-sm text-gray-700">
            <ul class="list-disc list-inside">
              <li>El código es obligatorio.</li>
              <li>El nombre es obligatorio.</li>
              <li>El valor por defecto es obligatorio y numérico.</li>
            </ul>
          </div>

          {#if saveErrors.length}
            <div bind:this={errorAlertEl} class="mb-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
              <ul class="list-disc list-inside">
                {#each saveErrors as se}
                  <li>{se}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="mt-3 mt-4 flex-shrink-0 flex justify-end gap-2 p-2 border-t border-gray-100 bg-white">
            <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
            <button class="btn-primary" on:click={submit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showConfirmDelete}
    <div class="fixed inset-0 flex items-center justify-center p-4" style="z-index:2100">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true"></div>
      <div class="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
        <h4 class="text-lg font-semibold mb-3">Confirmar eliminación</h4>
        <p class="mb-4">¿Seguro que deseas eliminar <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Esta acción no se puede deshacer.</p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" on:click={cancelDelete}>Cancelar</button>
          <button class="btn-primary" on:click={confirmDelete}>Eliminar</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showConfirmClose}
    <div class="fixed inset-0 flex items-center justify-center p-4" style="z-index:2100">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true"></div>
      <div class="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
        <h4 class="text-lg font-semibold mb-3">Cambios sin guardar</h4>
        <p class="mb-4">Hay cambios sin guardar. ¿Deseas descartarlos y cerrar el formulario?</p>
        <div class="flex justify-end gap-2">
          <button class="btn-secondary" on:click={cancelCloseDiscard}>Volver</button>
          <button class="btn-primary" on:click={confirmCloseDiscard}>Descartar y cerrar</button>
        </div>
      </div>
    </div>
  {/if}

</div>

<style>
  /* Table and action styles copied from customers page for visual consistency */
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
    border-radius: var(--radius-full);
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
      border-radius: var(--radius-lg);
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
      padding: 0.45rem 0.5rem;
      min-width: 36px;
      min-height: 36px;
      border-radius: var(--radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
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

  /* Pagination/info spacing to separate from table */
  .pagination-info {
    margin-top: 1.25rem; /* slightly larger gap */
    padding-top: 0.25rem;
  }
  @media (max-width: 640px) { .pagination-info { margin-top: 1rem; font-size: 0.875rem; } }

  .card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border-radius: var(--radius-xl);
    box-shadow: 
      0 4px 24px -1px rgba(53, 82, 140, 0.1),
      0 2px 8px -1px rgba(53, 82, 140, 0.06);
    border: 1px solid rgba(53, 82, 140, 0.08);
    padding: 1.5rem;
  }

  .input-field {
    width: 100%;
    /* base padding: slightly reduced left padding to avoid too much empty space */
    padding: 0.75rem 1rem 0.75rem 2.25rem;
    border-radius: var(--radius-lg);
    border: 1px solid #e5e7eb;
    font-size: 0.875rem;
  /* transitions disabled */
  transition: none;
    background: white;
    color: #1f2937;
  }

  .btn-primary {
    background: #35528C; /* solid color instead of gradient */
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-weight: 600;
    transition: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-secondary {
    background: white;
    color: #35528C;
    border: 2px solid #35528C;
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    font-weight: 600;
    transition: none;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.375rem;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
  }

  .btn-add {
    padding: 0.75rem 1rem;
    border-radius: var(--radius-lg);
    font-size: 0.95rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Modal content base styles so taxes modal matches other pages' visual language */
  .modal-content {
    border-radius: var(--radius-lg);
    box-shadow: 0 10px 30px rgba(53,82,140,0.08);
    border: 1px solid rgba(53,82,140,0.06);
    overflow: hidden;
    background: white;
  }

  /* Inputs inside modal: slightly more padding and use tokenized radius */
  .modal-content .input-field {
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
  }

  .input-field:focus, input[type="tel"]:focus, input[inputmode="numeric"]:focus {
    outline: none;
    border-color: #35528C;
    box-shadow: 0 1px 6px rgba(53, 82, 140, 0.12);
  }

  /* Use shared .row-selected from src/app.css */
</style>

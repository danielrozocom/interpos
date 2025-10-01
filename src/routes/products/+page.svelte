<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/Modal.svelte';
  import ConfirmDialog from '$lib/ConfirmDialog.svelte';
  let products: any[] = [];
  let loading = true;
  let error = '';
  let deleteSuccess = '';
  let searchTerm = '';
  let searchInput: HTMLInputElement | null = null;
  let modalIdInput: HTMLInputElement | null = null;
  let modalNameInput: HTMLInputElement | null = null;
  let sortBy: 'id' | 'name' | 'price' | 'category' = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  // Modal state
  let showModal = false;
  let editingProduct: any = null;
  let modalName = '';
  let modalId = '';
  let modalPrice: number | '' = '';
  let modalCategory = '';
  let modalCategoryNew = '';
  let saving = false;
  let saveErrors: string[] = [];
  let saveSuccess = false;
  let showConfirmDelete = false;
  let deleteTarget: any = null;

  // Scroll lock state
  let errorAlertEl: HTMLElement | null = null;

  $: categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  async function fetchProducts() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/sheets/products');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      products = Array.isArray(data.products) ? data.products : (Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Error loading products', e);
      error = e.message || 'Error al cargar productos';
      products = [];
    } finally {
      loading = false;
    }
  }

  function refreshProducts() {
    return fetchProducts();
  }

  $: filteredProducts = products.filter(p =>
    String(p.id).toLowerCase().includes(String(searchTerm).toLowerCase()) ||
    String(p.name || '').toLowerCase().includes(String(searchTerm).toLowerCase())
    || String(p.category || '').toLowerCase().includes(String(searchTerm).toLowerCase())
  );

  $: sortedProducts = filteredProducts.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'id':
        comparison = (Number(a.id) || 0) - (Number(b.id) || 0);
        break;
      case 'name':
        comparison = String(a.name || '').localeCompare(String(b.name || ''));
        break;
      case 'category':
        comparison = String(a.category || '').localeCompare(String(b.category || ''));
        break;
      case 'price':
        comparison = (Number(a.price) || 0) - (Number(b.price) || 0);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  function handleSort(column: 'id' | 'name' | 'price' | 'category') {
    if (sortBy === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortBy = column;
      sortDirection = 'asc';
    }
  }

  onMount(fetchProducts);

  function openModal(product: any | null = null) {
    editingProduct = product;
    if (product) {
      modalId = String(product.id || '');
      modalName = product.name || '';
      modalPrice = typeof product.price === 'number' ? product.price : '';
      // Pre-fill category; if category is empty use empty string
      modalCategory = product.category || '';
      modalCategoryNew = '';
    } else {
      modalId = '';
      modalName = '';
      modalPrice = '';
      modalCategory = '';
      modalCategoryNew = '';
    }
    saveErrors = [];
    saveSuccess = false;
    showModal = true;
    // focus inputs after render without causing scroll (Modal handles scroll lock)
    tick().then(() => {
      try {
        if (modalNameInput && editingProduct) {
          modalNameInput.focus({ preventScroll: true });
        } else if (modalIdInput) {
          modalIdInput.focus({ preventScroll: true });
          modalIdInput.select?.();
        }
      } catch (e) {
        try { modalNameInput?.focus(); } catch(_) {}
        try { modalIdInput?.focus(); } catch(_) {}
      }
    });
  }

  function closeModal() {
    showModal = false;
    saving = false;
    saveSuccess = false;
    // Modal component will restore scroll state
  }

  // Prevent modal from overlapping the fixed header:
  import { tick } from 'svelte';
  let headerHeight = 0;
  let modalMaxHeight = 0;
  let modalTop = 0; // computed absolute top in px
  let modalEl: HTMLElement | null = null;

  function updateModalLayout() {
    if (typeof window === 'undefined') return;
    const header = document.querySelector('header.topbar') as HTMLElement | null;
    headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 52;
    const gap = 16; // desired gap from header
    // compute max height available for modal content
    const available = Math.max(200, window.innerHeight - (headerHeight + gap * 2));
    modalMaxHeight = available;
    // if modal is open and rendered, measure and center it in the available area
    if (showModal) measureModal();
  }

  async function measureModal() {
    await tick();
    if (!modalEl || typeof window === 'undefined') return;
    const gap = 16; // gap from header and bottom
    // compute available area below header so modal doesn't overlap header
    const available = Math.max(200, window.innerHeight - (headerHeight + gap * 2));
    const modalHeight = Math.min(modalEl.getBoundingClientRect().height, available);
    // position the modal centered within the available area below the header
    modalTop = headerHeight + gap + Math.max(0, Math.floor((available - modalHeight) / 2));
  }

  function onResize() {
    updateModalLayout();
  }

  if (typeof window !== 'undefined') {
    updateModalLayout();
    window.addEventListener('resize', onResize);
  }

  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (typeof window !== 'undefined') {
      // ensure modal-open class removed on destroy
      try {
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
      } catch (e) {}
    }
  });

  async function submitProduct() {
    saveErrors = [];
    if (modalId === '' || String(modalId).trim() === '') saveErrors.push('El ID es obligatorio.');
    else if (isNaN(Number(modalId))) saveErrors.push('El ID debe ser numérico.');
    if (!modalName || String(modalName).trim() === '') saveErrors.push('El nombre es obligatorio.');
    if (modalPrice === '' || modalPrice === null) {
      saveErrors.push('El precio es obligatorio.');
    } else if (isNaN(Number(modalPrice))) {
      saveErrors.push('El precio debe ser numérico.');
    }
    // Resolve category value (if selecting "Nueva categoría" use modalCategoryNew)
    const categoryFinal = modalCategory === '__new__' ? String(modalCategoryNew || '').trim() : String(modalCategory || '').trim();
    if (!categoryFinal) saveErrors.push('La categoría es obligatoria.');
    if (saveErrors.length) {
      await tick();
      try { errorAlertEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
      return;
    }

    saving = true;
    try {
      const payload = { id: modalId, name: modalName, price: Number(modalPrice), category: categoryFinal };
      const res = await fetch('/api/sheets/products/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        saveErrors = [data?.error || 'Error guardando producto'];
        await tick();
        try { errorAlertEl?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
        throw new Error(data?.error || 'Error guardando producto');
      }
      await fetchProducts();
      saveSuccess = true;
      
      // Cerrar modal automáticamente después de 1.5 segundos
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (e: any) {
      saveErrors = [e.message || 'Error al guardar producto'];
    } finally {
      saving = false;
    }
  }

  // Open confirmation dialog for deletion
  function deleteProduct(p: any) {
    deleteTarget = p;
    showConfirmDelete = true;
  }

  // Called when user confirms deletion in ConfirmDialog
  async function performDeleteConfirmed() {
    const p = deleteTarget;
    deleteTarget = null;
    showConfirmDelete = false;
    if (!p) return;
    try {
      const res = await fetch('/api/sheets/products/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id })
      });
      if (!res.ok) throw new Error('Error al eliminar');
      await fetchProducts();
      deleteSuccess = 'Producto eliminado correctamente';
      setTimeout(() => {
        deleteSuccess = '';
      }, 3000);
    } catch (e) {
      // keep UX consistent with other pages
      try { alert('No se pudo eliminar el producto'); } catch(_) {}
    }
  }
</script>

<svelte:head>
  <title>Productos | InterPOS</title>
</svelte:head>

<div class="products-page max-w-6xl mx-auto p-4">
  <div class="mb-8 text-center">
    <h1 class="text-4xl font-bold text-[#35528C] mb-1 font-sans s-xAzoHdC_kP8W">Gestión de Productos</h1>
    <p class="text-lg text-[#35528C]/80 font-sans max-w-3xl mx-auto s-xAzoHdC_kP8W">Administra el catálogo de productos disponibles para venta</p>
  </div>

  {#if deleteSuccess}
    <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg max-w-6xl mx-auto">
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span class="text-sm font-medium text-green-800">{deleteSuccess}</span>
      </div>
    </div>
  {/if}
  <!-- Controls similar to users page -->
  <div class="card glass-effect s-xAzoHdC_kP8W mb-6">
    <div class="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <div class="w-full lg:flex-1 lg:max-w-md">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none search-icon">
            <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input bind:this={searchInput} type="text" bind:value={searchTerm} placeholder="Buscar por ID o nombre..." class="input-field input-with-icon pr-10 s-xAzoHdC_kP8W" />
          {#if searchTerm}
            <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label="Limpiar búsqueda" on:click={() => { searchTerm = ''; try { searchInput?.focus({ preventScroll: true }); } catch(e) { searchInput?.focus(); } }}>
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2 w-auto mr-auto">
        <div class="flex items-center gap-3">
          <button type="button" class="inline-flex items-center justify-center p-3 rounded-full" on:click={() => openModal(null)} title="Agregar producto" aria-label="Agregar producto" style="background-color: #35528C; color: white;">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: white"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button type="button" class="inline-flex items-center justify-center p-3 rounded-full" on:click={refreshProducts} title="Sincronizar" aria-label="Sincronizar" style="background-color: #35528C; color: white;">
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: white"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
        <div class="flex items-center gap-4 sm:gap-6 text-sm">
          <div class="text-center">
            <div class="font-semibold text-[#35528C]">{products.length}</div>
            <div class="text-gray-600">Total productos</div>
          </div>
        </div>

        <!-- Removed duplicate textual 'Actualizar' button to keep only the circular sync control on the left -->
      </div>
    </div>
  </div>

  <!-- Products Table (users-style) -->
  <div class="card glass-effect s-xAzoHdC_kP8W overflow-hidden">
    {#if loading}
      <div class="text-center py-12">
        <svg class="animate-spin h-8 w-8 text-[#35528C] mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <p class="text-gray-600">Cargando productos...</p>
      </div>
    {:else if filteredProducts.length === 0}
      <div class="text-center py-12">
        <svg class="h-14 w-14 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No se encontraron productos</h3>
        {#if searchTerm}
          <p class="text-gray-700 font-medium mb-1">No hay resultados para "{searchTerm}"</p>
          <p class="text-gray-600">Intenta con otros términos de búsqueda (ID o nombre).</p>
        {:else}
          <p class="text-gray-600">No hay productos registrados en el sistema.</p>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-white">
            <tr>
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('id')}>
                <div class="flex items-center justify-start">
                  <span>ID</span>
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
              <th class="table-header cursor-pointer text-left" on:click={() => handleSort('category')}>
                <div class="flex items-center justify-start">
                  <span>Categoría</span>
                  <svg class="h-4 w-4 {sortBy === 'category' ? 'text-[#35528C]' : 'text-gray-400'} ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortBy === 'category' && sortDirection === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                </div>
              </th>
              <th class="table-header cursor-pointer text-right" on:click={() => handleSort('price')}>
                <div class="flex items-center justify-end">
                  <span>Precio</span>
                  <svg class="h-4 w-4 ml-2 {sortBy === 'price' ? 'text-[#35528C]' : 'text-gray-400'}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sortBy === 'price' && sortDirection === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                </div>
              </th>
              <th class="table-header text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each sortedProducts as p, index (p.id)}
              <tr class="hover:bg-gray-50 transition-colors duration-150 {index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                <td class="table-cell id-cell font-sans font-normal text-[#35528C] text-base">{p.id}</td>
                <td class="table-cell name-cell text-base"><div class="font-medium text-gray-900">{p.name}</div></td>
                <td class="table-cell category-cell text-base"><div class="text-sm text-gray-600">{p.category || '—'}</div></td>
                <td class="table-cell text-right text-base"><span class="font-bold product-price">${p.price?.toLocaleString ? p.price.toLocaleString('es-CO') : p.price}</span></td>
                <td class="table-cell actions-cell">
                  <div class="flex items-center justify-center gap-2">
                    <button class="btn-sm btn-primary" title="Editar producto" aria-label="Editar producto" on:click={() => openModal(p)}>
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"></path>
                        <path d="M20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>
                      </svg>
                    </button>
                    <button class="btn-sm btn-secondary" title="Eliminar producto" aria-label="Eliminar producto" on:click={() => deleteProduct(p)}>
                      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
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
  <div class="pagination-info mt-4 text-center text-sm text-gray-600 s-xAzoHdC_kP8W">
    Mostrando {filteredProducts.length} de {products.length} productos
  </div>

  {#if showModal}
    <Modal bind:open={showModal} title={editingProduct ? 'Editar producto' : 'Agregar producto'} busy={saving}>
      <div class="p-2">
        <h3 class="sr-only">{editingProduct ? 'Editar producto' : 'Agregar producto'}</h3>

        <label for="modalId" class="block text-sm text-gray-700">ID <span class="text-red-600">*</span></label>
        <input id="modalId" bind:value={modalId} class="input-field mt-2 mb-3" required aria-required="true" type="number" inputmode="numeric" pattern="\d*" />

        <label for="modalName" class="block text-sm text-gray-700">Nombre <span class="text-red-600">*</span></label>
        <input id="modalName" bind:value={modalName} class="input-field mt-2 mb-3" required aria-required="true" />

        <label for="modalPrice" class="block text-sm text-gray-700">Precio <span class="text-red-600">*</span></label>
        <input id="modalPrice" bind:value={modalPrice} class="input-field mt-2 mb-3" inputmode="numeric" required aria-required="true" type="number" step="0.01" />

        <label for="modalCategory" class="block text-sm text-gray-700">Categoría <span class="text-red-600">*</span></label>
        <div class="mt-2 mb-3">
          <select id="modalCategory" bind:value={modalCategory} class="input-field w-full">
            <option value="">Seleccione una categoría</option>
            {#each categories as c}
              <option value={c}>{c}</option>
            {/each}
            <option value="__new__">-- Nueva categoría --</option>
          </select>
          {#if modalCategory === '__new__'}
            <input id="modalCategoryNew" bind:value={modalCategoryNew} placeholder="Nombre de la nueva categoría" class="input-field mt-2" />
          {/if}
        </div>

        <!-- moved alerts to footer slot for consistent placement and auto-scroll -->

    </div>
    <svelte:fragment slot="footer">
      {#if saveErrors && saveErrors.length > 0}
        <div bind:this={errorAlertEl} class="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg" style="border-radius: var(--radius-lg);">
          <div class="flex items-center space-x-2 mb-2">
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span class="text-sm font-medium text-red-800">Errores encontrados:</span>
          </div>
          <ul class="list-disc list-inside text-sm text-red-700 ml-7">
            {#each saveErrors as e}
              <li>{e}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if saveSuccess}
        <div bind:this={errorAlertEl} class="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg" style="border-radius: var(--radius-lg);">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span class="text-sm font-medium text-green-800">
              {#if editingProduct}
                Producto actualizado correctamente
              {:else}
                Producto creado correctamente
              {/if}
            </span>
          </div>
        </div>
      {/if}

      <div class="flex justify-end gap-2">
        <button class="btn-secondary" on:click={closeModal} disabled={saving}>Cancelar</button>
        <button class="btn-primary" on:click|preventDefault={submitProduct} disabled={saving}>
          {#if saving}
            <svg class="h-4 w-4 animate-spin mr-2" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          {/if}
          {saving ? 'Guardando...' : (editingProduct ? 'Guardar' : 'Crear')}
        </button>
      </div>
    </svelte:fragment>
  </Modal>
  {/if}
</div>

<!-- styles are provided globally in src/app.css (tokenized and Tailwind-processed). Local styles removed to avoid conflicts. -->
 
 {#if showConfirmDelete}
  <ConfirmDialog bind:open={showConfirmDelete}
    title="Confirmar eliminación"
    itemName={`${deleteTarget?.name || ''}`}
    itemLabel={`(${deleteTarget?.id || ''})`}
    on:confirm={performDeleteConfirmed}
    on:cancel={() => { showConfirmDelete = false; deleteTarget = null; }} />
 {/if}
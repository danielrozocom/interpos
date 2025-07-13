<script lang="ts">
  import { onMount } from 'svelte';
  
  let users: Array<{id: string, name: string, balance: number}> = [];
  let loading = true;

  async function fetchUsers() {
    try {
      const res = await fetch('/api/sheets/users');
      users = await res.json();
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      loading = false;
    }
  }

  function formatCurrency(val: number): string {
    return `$${isNaN(val) ? 0 : Math.round(val).toLocaleString('es-MX')}`;
  }

  $: totalBalance = users.reduce((sum, user) => sum + user.balance, 0);

  onMount(fetchUsers);
</script>

<svelte:head>
  <title>InterPOS - Dashboard</title>
</svelte:head>


<div class="space-y-8">
  <!-- Header -->
  <div class="text-center">
    <h1 class="text-4xl font-bold text-gray-900 mb-2">Bienvenido a InterPOS</h1>
    <p class="text-xl text-gray-600">Sistema de gestión de puntos de venta</p>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="card">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-white text-lg">👥</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Total Usuarios</p>
          <p class="text-2xl font-bold text-gray-900">{users.length}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <span class="text-white text-lg">💰</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Balance Total</p>
          <p class="text-2xl font-bold text-gray-900">{formatCurrency(totalBalance)}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
            <span class="text-white text-lg">📊</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Promedio por Usuario</p>
          <p class="text-2xl font-bold text-gray-900">
            {users.length > 0 ? formatCurrency(totalBalance / users.length) : formatCurrency(0)}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="card">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Acciones Rápidas</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <a href="/recharge" class="group block">
        <div class="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-6 transition-colors duration-200">
          <div class="flex items-center">
            <span class="text-3xl mr-4">💰</span>
            <div>
              <h3 class="text-lg font-semibold text-blue-900">Recargar Saldo</h3>
              <p class="text-sm text-blue-700">Añadir fondos a cuentas de usuarios</p>
            </div>
          </div>
        </div>
      </a>

      <a href="/history" class="group block">
        <div class="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-6 transition-colors duration-200">
          <div class="flex items-center">
            <span class="text-3xl mr-4">📋</span>
            <div>
              <h3 class="text-lg font-semibold text-green-900">Ver Historial</h3>
              <p class="text-sm text-green-700">Consultar transacciones de usuarios</p>
            </div>
          </div>
        </div>
      </a>
    </div>
  </div>

  <!-- Users Overview -->
  <div class="card">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Usuarios Registrados</h2>
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600">Cargando usuarios...</span>
      </div>
    {:else if users.length === 0}
      <div class="text-center py-12">
        <span class="text-6xl">👥</span>
        <h3 class="text-lg font-medium text-gray-900 mt-4">No hay usuarios registrados</h3>
        <p class="text-gray-500 mt-2">Los usuarios aparecerán aquí cuando se registren en el sistema.</p>
      </div>
    {:else}
      <div class="overflow-hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {#each users as user}
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-500">ID: {user.id}</span>
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium {user.balance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                  {user.balance >= 0 ? '✓' : '⚠'}
                </span>
              </div>
              <h3 class="font-semibold text-gray-900 mb-2 truncate" title={user.name}>{user.name}</h3>
              <p class="text-lg font-bold {user.balance >= 0 ? 'text-green-600' : 'text-red-600'}">
                {formatCurrency(user.balance)}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

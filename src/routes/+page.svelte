<script lang="ts">
  import { onMount } from 'svelte';
  import { siteName } from '../lib/config';
  
  let users: Array<{id: string, name: string, balance: number}> = [];
  let loading = true;
  let error = '';

  async function fetchUsers() {
    try {
      const res = await fetch('/api/sheets/users');
      if (!res.ok) {
        throw new Error('Error al obtener usuarios');
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        users = data.map(user => ({
          ...user,
          balance: Number(user.balance) || 0
        }));
      } else {
        throw new Error('Formato de respuesta inválido');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      error = err.message || 'Error al cargar los usuarios';
      users = [];
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
  <title>{siteName}</title>
  <meta name="description" content="Sistema de punto de venta" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <div class="text-center mb-12">
    <h1 class="text-4xl font-bold text-[#35528C] mb-2">Bienvenido a {siteName}</h1>
    <p class="text-[#35528C]/80">Panel de Administración</p>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
    <div class="bg-white p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-blue-100 text-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-xl">👥</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Total Usuarios</p>
          <p class="text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-6 w-20 bg-gray-200 rounded animate-pulse"></span>
            {:else}
              {users.length}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-green-100 text-green-500 rounded-lg flex items-center justify-center">
            <span class="text-xl">💰</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Balance Total</p>
          <p class="text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-6 w-24 bg-gray-200 rounded animate-pulse"></span>
            {:else}
              {formatCurrency(totalBalance)}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-12 h-12 bg-purple-100 text-purple-500 rounded-lg flex items-center justify-center">
            <span class="text-xl">📊</span>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-600">Promedio por Usuario</p>
          <p class="text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-6 w-24 bg-gray-200 rounded animate-pulse"></span>
            {:else}
              {users.length > 0 ? formatCurrency(totalBalance / users.length) : formatCurrency(0)}
            {/if}
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Action Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Tarjeta de Venta -->
    <a href="/sell" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
      <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-2xl">💰</span>
      </div>
      <h2 class="text-xl font-semibold text-[#35528C] mb-2">Vender</h2>
      <p class="text-gray-600">Realiza una venta y descuenta productos del saldo del usuario.</p>
    </a>

    <!-- Tarjeta de Recarga -->
    <a href="/recharge" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
      <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-2xl">💳</span>
      </div>
      <h2 class="text-xl font-semibold text-[#35528C] mb-2">Recargar</h2>
      <p class="text-gray-600">Agrega saldo a la cuenta de un usuario.</p>
    </a>

    <!-- Tarjeta de Historial -->
    <a href="/history" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
      <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-2xl">📊</span>
      </div>
      <h2 class="text-xl font-semibold text-[#35528C] mb-2">Historial</h2>
      <p class="text-gray-600">Consulta el historial de transacciones.</p>
    </a>
  </div>

  <!-- User List -->
  {#if !loading && users.length > 0}
    <div class="bg-white rounded-lg shadow-lg overflow-hidden mt-12">
      <div class="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900">
          Lista de Usuarios
        </h3>
      </div>
      <div class="bg-white">
        <ul class="divide-y divide-gray-200">
          {#each users as user}
            <li class="px-4 py-4 sm:px-6 hover:bg-gray-50">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-8 h-8 bg-[#35528C] rounded-full flex items-center justify-center text-white">
                    {user.name[0].toUpperCase()}
                  </div>
                  <div class="ml-3">
                    <p class="text-sm font-medium text-gray-900">{user.name}</p>
                    <p class="text-sm text-gray-500">ID: {user.id}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-900">{formatCurrency(user.balance)}</p>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    background-color: #f3f4f6;
  }
</style>

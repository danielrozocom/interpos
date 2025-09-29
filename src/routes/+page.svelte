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
        // Use parseCurrency to normalize balances like "$0" or "- $17,800"
        const { parseCurrency } = await import('../lib/parseCurrency');
        users = data.map(user => ({
          ...user,
          balance: parseCurrency(user.balance)
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

  onMount(() => {
    fetchUsers();
  });
</script>

<svelte:head>
  <title>{siteName}</title>
  <meta name="description" content="Sistema de punto de venta" />
</svelte:head>

<div class="max-w-7xl mx-auto px-4 pb-16">
  {#if error}
  <div class="mb-4 p-4 rounded-lg message-error shadow-sm">
      <div class="flex items-center">
        <span class="text-2xl mr-3">❌</span>
        <p class="text-lg font-medium">{error}</p>
      </div>
    </div>
  {/if}

  <div class="text-center mb-2">
    <h1 class="text-4xl font-bold text-[#35528C] mb-1">Bienvenido a {siteName}</h1>
    <p class="text-[#35528C]/80">Panel de Administración</p>
  </div>

  <!-- Stats Cards Principales -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4">
    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 text-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-lg sm:text-xl">👥</span>
          </div>
        </div>
        <div class="ml-3 sm:ml-4">
          <p class="text-sm sm:text-base font-medium text-gray-600">Total Clientes</p>
          <p class="text-xl sm:text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-5 sm:h-6 w-16 sm:w-20 bg-gray-200 rounded animate-pulse"></span>
            {:else}
              {users.length}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 text-green-500 rounded-lg flex items-center justify-center">
            <span class="text-lg sm:text-xl">💰</span>
          </div>
        </div>
        <div class="ml-3 sm:ml-4">
          <p class="text-sm sm:text-base font-medium text-gray-600">Balance Total</p>
          <p class="text-xl sm:text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-5 sm:h-6 w-24 sm:w-32 bg-gray-200 rounded animate-pulse"></span>
            {:else}
              {formatCurrency(totalBalance)}
            {/if}
          </p>
        </div>
      </div>
    </div>

    <div class="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 text-purple-500 rounded-lg flex items-center justify-center">
            <span class="text-lg sm:text-xl">📊</span>
          </div>
        </div>
        <div class="ml-3 sm:ml-4">
          <p class="text-sm sm:text-base font-medium text-gray-600">Promedio por Cliente</p>
          <p class="text-xl sm:text-2xl font-bold text-gray-900">
            {#if loading}
              <span class="inline-block h-5 sm:h-6 w-20 sm:w-28 bg-gray-200 rounded animate-pulse"></span>
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
  <p class="text-gray-600">Realiza una venta y descuenta productos del saldo del cliente.</p>
    </a>

    <!-- Tarjeta de Recarga -->
    <a href="/recharge" class="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow duration-200">
      <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
        <span class="text-2xl">💳</span>
      </div>
      <h2 class="text-xl font-semibold text-[#35528C] mb-2">Recargar</h2>
  <p class="text-gray-600">Agrega saldo a la cuenta de un cliente.</p>
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
</div>

<style>
  :global(body) {
    background-color: #f3f4f6;
  }
</style>

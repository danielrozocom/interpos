<svelte:head>
  <title>Consulta tu Saldo | InterPOS</title>
  <meta name="description" content="Consulta el saldo y los últimos movimientos de tu cuenta en InterPOS ingresando tu ID de usuario." />
</svelte:head>
<script lang="ts">
import { onMount } from 'svelte';

let userId = '';
let userSuggestions: any[] = [];
let transactions: any[] = [];
let balance = null;
let error = '';
let loading = false;
let name = '';

$: if (!userId) name = '';

  function cleanNumber(str: string | number): number {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    // Elimina $ y comas, conserva el signo
    return Number(String(str).replace(/[^\d.-]/g, ''));
  }

  function formatCurrency(val: number): string {
    return `$${isNaN(val) ? 0 : Math.round(val).toLocaleString('es-MX')}`;
  }

  // Eliminar búsqueda en cada input para evitar sobrecarga
  // El nombre se obtiene al consultar saldo

  async function checkBalance() {
    if (!userId) {
      error = 'Por favor ingresa un ID de usuario';
      return;
    }

    loading = true;
    error = '';

    try {
      // Obtener el saldo
      const balanceResponse = await fetch(`/api/sheets/users?userId=${encodeURIComponent(userId)}`);
      if (!balanceResponse.ok) throw new Error('Error al obtener el saldo');
      const balanceData = await balanceResponse.json();
      console.log('balanceData:', balanceData); // Debug API response
      balance = balanceData.balance;
      name = balanceData.name || '';

      // Obtener las últimas 10 transacciones
      const historyResponse = await fetch(`/api/sheets/history?userId=${encodeURIComponent(userId)}`);
      if (!historyResponse.ok) throw new Error('Error al obtener el historial');
      const allTransactions = await historyResponse.json();
      
      // Procesar las transacciones
      transactions = allTransactions.map(t => ({
        timestamp: t.Date,
        amount: cleanNumber(t.Quantity),
        method: t.Method,
        notes: t['Observation(s)']
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Obtener solo las últimas 10
    } catch (err) {
      console.error('Error:', err);
      error = 'No existe un usuario con ese ID';
      balance = null;
      transactions = [];
      name = '';
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <h1 class="text-3xl font-extrabold mb-8 tracking-tight" style="color:#35528C">Consulta tu Saldo</h1>

  <div class="bg-gradient-to-br from-[#35528C]/10 via-white to-blue-50 shadow-lg rounded-xl p-8 mb-8 border" style="border-color:#35528C">
    <form on:submit|preventDefault={checkBalance} class="space-y-6">
      <div class="relative">
        <label for="userId" class="block text-base font-semibold mb-2 tracking-wide" style="color:#35528C">
          ID de Usuario
        </label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            inputmode="numeric"
            pattern="[0-9]*"
            id="userId"
            bind:value={userId}
            class="mt-1 block w-full rounded-lg border-2 focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C] border-[#35528C]/30 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 transition-all duration-150 shadow-sm sm:text-base"
            placeholder="Ingresa tu ID de usuario"
          />
        </div>

        <!-- Sugerencias eliminadas para evitar sobrecarga -->
      </div>

      <div class="flex justify-end">
        <button
          type="submit"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-[#35528C] py-2 px-6 text-base font-semibold text-white shadow hover:bg-[#27406B] focus:outline-none focus:ring-2 focus:ring-[#35528C] focus:ring-offset-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {#if loading}
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
            Consultando...
          {:else}
            Consultar Saldo
          {/if}
        </button>
      </div>
    </form>

    {#if error}
      <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
        <svg class="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        <p class="text-base text-red-700 font-medium">{error}</p>
      </div>
    {/if}
  </div>

  {#if balance !== null}
    <div class="bg-gradient-to-br from-[#35528C]/10 via-white to-blue-50 shadow-lg rounded-xl p-8 mb-8 border flex flex-col items-center" style="border-color:#35528C">
      <h2 class="text-2xl font-extrabold mb-2 text-center" style="color:#35528C">
        Hola{#if name}&nbsp;<span class="text-[#35528C]">{name}</span>{/if}, tu saldo es
      </h2>
      <p class="text-4xl font-extrabold text-green-600 mb-2 text-center">{formatCurrency(balance)}</p>
      <span class="text-sm text-gray-500 mb-4 text-center">Actualizado al último movimiento</span>
      <h3 class="text-lg font-semibold mb-2 text-center" style="color:#35528C">Tus últimos 10 movimientos</h3>
      {#if transactions.length > 0}
        <div class="bg-white shadow-xl rounded-xl overflow-hidden border w-full" style="border-color:#35528C">
          <div class="mt-2 overflow-x-auto">
            <table class="min-w-full divide-y" style="border-color:#35528C">
              <thead class="bg-[#35528C]/10">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Tipo</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Cantidad</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Método</th>
                  <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider" style="color:#35528C">Observaciones</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y" style="border-color:#35528C">
                {#each transactions as transaction}
                  <tr class="hover:bg-[#35528C]/10 transition-colors duration-100">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.timestamp).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class={transaction.amount >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {transaction.amount >= 0 ? 'Recarga' : 'Consumo'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <span class={transaction.amount >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                        {formatCurrency(Math.abs(cleanNumber(transaction.amount)))}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" style="color:#35528C">
                      {transaction.method || '-'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-700">
                      {transaction.notes || '-'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
 
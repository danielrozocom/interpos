<![CDATA[<script lang="ts">
  let userId = '';
  let userSuggestions: any[] = [];
  let transactions: any[] = [];
  let balance = null;
  let error = '';
  let loading = false;

  async function searchUser() {
    if (userId.length < 3) {
      userSuggestions = [];
      return;
    }

    try {
      const response = await fetch(`/api/users?search=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Error al buscar usuarios');
      userSuggestions = await response.json();
    } catch (err) {
      console.error('Error:', err);
      error = 'Error al buscar usuarios';
    }
  }

  async function selectUser(suggestion: string) {
    userId = suggestion;
    userSuggestions = [];
    await checkBalance();
  }

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
      balance = balanceData.balance;

      // Obtener las últimas 10 transacciones
      const historyResponse = await fetch(`/api/sheets/history?userId=${encodeURIComponent(userId)}`);
      if (!historyResponse.ok) throw new Error('Error al obtener el historial');
      const allTransactions = await historyResponse.json();
      
      // Procesar las transacciones
      transactions = allTransactions.map(t => ({
        timestamp: t.Date,
        amount: parseFloat(t.Quantity),
        method: t.Method,
        notes: t['Observation(s)']
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // Obtener solo las últimas 10
    } catch (err) {
      console.error('Error:', err);
      error = 'Error al obtener los datos';
      balance = null;
      transactions = [];
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold text-gray-900 mb-6">Consulta tu Saldo</h1>

  <div class="bg-white shadow rounded-lg p-6 mb-6">
    <form on:submit|preventDefault={checkBalance} class="space-y-6">
      <div class="relative">
        <label for="userId" class="block text-sm font-medium text-gray-700 mb-2">
          ID de Usuario
        </label>
        <input
          type="text"
          id="userId"
          bind:value={userId}
          on:input={searchUser}
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Ingresa tu ID de usuario"
        />

        {#if userSuggestions.length > 0}
          <div class="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200">
            <ul class="max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
              {#each userSuggestions as suggestion}
                <li
                  class="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50"
                  on:click={() => selectUser(suggestion)}
                >
                  {suggestion}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="flex justify-end">
        <button
          type="submit"
          class="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          disabled={loading}
        >
          {loading ? 'Consultando...' : 'Consultar Saldo'}
        </button>
      </div>
    </form>

    {#if error}
      <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
        <p class="text-sm text-red-600">{error}</p>
      </div>
    {/if}
  </div>

  {#if balance !== null}
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Tu Saldo Actual</h2>
      <p class="text-3xl font-bold text-indigo-600">${balance.toLocaleString('es-MX')}</p>
    </div>

    {#if transactions.length > 0}
      <div class="bg-white shadow rounded-lg overflow-hidden">
        <h2 class="text-lg font-medium text-gray-900 p-6 pb-0">Últimos Movimientos</h2>
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Método</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Observaciones</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {#each transactions as transaction}
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.timestamp).toLocaleDateString('es-MX')}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {transaction.amount >= 0 ? 'Recarga' : 'Consumo'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${Math.abs(transaction.amount).toLocaleString('es-MX')}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.method || '-'}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900">
                    {transaction.notes || '-'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>]]>

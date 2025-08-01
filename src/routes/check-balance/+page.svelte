<script lang="ts">
  import { onMount } from 'svelte';
  // Solo mantenemos formatDate para casos especiales, los campos dateOnly y timeOnly vienen del servidor
  import { formatDate } from '../../lib/date-utils';

  let userId = '';
  let userSuggestions: any[] = [];
  let transactions: any[] = [];
  let balance: number | null = null;
  let error = '';
  let loading = false;
  let name = '';


  $: if (userId === '') name = '';

  // Convierte string o número a número limpio, manejando correctamente los negativos
  function cleanNumber(str: string | number): number {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    
    // Verificar si el número es negativo
    const isNegative = String(str).startsWith('-');
    // Limpiar todo excepto números y punto decimal
    const cleaned = String(str).replace(/[^\d.]/g, '');
    
    // Convertir a número y aplicar el signo negativo si es necesario
    const num = parseFloat(cleaned) || 0;
    return isNegative ? -Math.abs(num) : num;
  }

  // Formatea número como moneda
  function formatCurrency(val: number): string {
    if (isNaN(val)) return '$0';
    const absVal = Math.abs(val);
    const formatted = Math.round(absVal).toLocaleString('es-MX');
    return val < 0 ? `-$${formatted}` : `$${formatted}`;
  }

  // Validación para permitir números, signo negativo y manejar Enter
  function validateNumericInput(event: KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    
    // Permitir Enter para enviar el formulario
    if (event.key === 'Enter') {
      event.preventDefault();
      checkBalance();
      return;
    }
    
    // Permitir atajos de teclado (Ctrl+C, Ctrl+V, etc.)
    if (event.ctrlKey || event.metaKey) {
      return; // Permitir comandos del sistema
    }
    
    if (allowedKeys.includes(event.key)) {
      return;
    }
    
    // Permitir dígitos, signo negativo solo al principio
    const isMinusSign = event.key === '-' && input.selectionStart === 0;
    if (!/^[0-9]$/.test(event.key) && !isMinusSign) {
      event.preventDefault();
    }
  }
  
  // Manejar el evento de pegado
  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text/plain') || '';
    
    // Permitir solo números y signo negativo al principio
    const hasMinus = pastedText.startsWith('-');
    const numbersOnly = (hasMinus ? '-' : '') + pastedText.replace(/[^0-9]/g, '');
    
    if (numbersOnly) {
      const input = event.target as HTMLInputElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = input.value;
      
      // Insertar el texto pegado en la posición del cursor
      const newValue = currentValue.substring(0, start) + numbersOnly + currentValue.substring(end);
      
      // Actualizar el valor del input
      input.value = newValue;
      
      // Actualizar la variable userId
      userId = newValue;
      
      // Mover el cursor a la posición correcta
      const newCursorPos = start + numbersOnly.length;
      setTimeout(() => {
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }

  // Maneja Enter en input para consultar saldo
  function handleKeydown(event: KeyboardEvent) {
    validateNumericInput(event);
    if (event.key === 'Enter' && userId && !loading) {
      checkBalance();
    }
  }

  // Limpia caracteres no numéricos al pegar
  function cleanPastedValue(event: ClipboardEvent) {
    event.preventDefault();
    const paste = (event.clipboardData || (window as any).clipboardData).getData('text');
    const numericValue = paste.replace(/[^0-9]/g, '');
    userId = numericValue;
  }


  async function checkBalance() {
    if (!userId) {
      error = 'Por favor ingresa un ID de usuario';
      return;
    }

    loading = true;
    error = '';
    // Limpiar datos anteriores al iniciar nueva consulta
    balance = null;
    transactions = [];
    name = '';

    try {
      // Obtener el saldo del usuario primero
      const balanceResponse = await fetch(`/api/sheets/users?userId=${encodeURIComponent(userId)}`);
      if (!balanceResponse.ok) throw new Error('Error al obtener el saldo');
      const balanceData = await balanceResponse.json();
      console.log('Balance data received:', balanceData);
      console.log('Raw balance value:', balanceData.balance, 'Type:', typeof balanceData.balance);
      balance = balanceData.balance;
      name = balanceData.name || '';
      console.log('Processed balance:', balance, 'Name:', name);

      // Obtener el historial
      const historyResponse = await fetch(`/api/sheets/history?userId=${encodeURIComponent(userId)}`);
      if (!historyResponse.ok) throw new Error('Error al obtener el historial');
      const allTransactions = await historyResponse.json();

      // Si no tenemos nombre del balance, usar el del historial
      if (!name && allTransactions.length > 0) {
        name = allTransactions[0].Name || '';
      }

      // Procesar y ordenar las transacciones (más reciente primero)
      transactions = allTransactions
        .map((t: any) => {
          return {
            dateOnly: t.dateOnly || '',
            timeOnly: t.timeOnly || '',
            amount: cleanNumber(t.Quantity),
            method: t.Method,
            notes: t['Observation(s)'],
            orderID: t.orderID
          };
        })
        .sort((a: any, b: any) => {
          // Combina fecha y hora para comparar
          const aDate = new Date(`${a.dateOnly}T${a.timeOnly}`);
          const bDate = new Date(`${b.dateOnly}T${b.timeOnly}`);
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, 10); // Obtener solo las últimas 10

      console.log('Processed transactions:', transactions.map(t => ({
        dateOnly: t.dateOnly,
        timeOnly: t.timeOnly,
        amount: t.amount
      })));
    } catch (err) {
      console.error('Error:', err);
      error = 'No existe un usuario con ese ID';
      balance = null;
      transactions = [];
      // No limpiar el nombre para mantenerlo visible al editar ID
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Consulta tu Saldo | InterPOS</title>
  <meta name="description" content="Consulta el saldo y los últimos movimientos de tu cuenta en InterPOS ingresando tu ID de usuario." />
</svelte:head>

<div class="min-h-screen bg-gray-50 p-4">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-[#35528C] mb-3 mt-3 font-sans">Consulta tu Saldo</h1>

      <p class="text-lg text-[#35528C]/80 font-sans max-w-2xl mx-auto">Ingresa tu ID para ver tu saldo actual y el historial de movimientos de tu cuenta</p>
    </div>

    <!-- User Input Section -->
    <div class="bg-white rounded-2xl shadow-lg border border-[#35528C]/10 p-8 mb-8 transform transition-all duration-200 hover:shadow-xl">
      <div class="max-w-xl mx-auto">
        <label class="block text-lg font-semibold text-[#35528C] mb-3" for="userId">
          ID de Usuario
        </label>
        <div class="flex flex-col sm:flex-row gap-4">
          <input
            type="tel"
            id="userId"
            bind:value={userId}
            on:keydown={validateNumericInput}
            on:paste={handlePaste}
            class="flex-1 h-12 rounded-xl border-2 border-gray-200 shadow-sm focus:border-[#35528C] focus:ring-2 focus:ring-[#35528C]/20 text-lg px-4"
            placeholder="Ingresa tu ID"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
          />
          <button
            type="button"
            on:click={checkBalance}
            class="h-12 px-8 w-full sm:w-auto rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg {loading || !userId ? 'bg-gray-400 cursor-not-allowed opacity-60' : 'bg-[#35528C] hover:bg-[#2A4170] hover:shadow-[#35528C]/20'}"
            disabled={loading || !userId}
          >
            {#if loading}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Consultando
              </span>
            {:else}
              Consultar
            {/if}
          </button>
        </div>
      </div>
    </div>

    {#if error}
      <div class="max-w-xl mx-auto mb-8 transform animate-fadeIn">
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

    {#if balance !== null}
      <div class="space-y-8 transform animate-fadeIn">
        <!-- Saldo Card -->
        <div class="bg-gradient-to-br from-[#35528C] to-[#2A4170] rounded-2xl shadow-lg p-8 text-white">
          <div class="text-center">
            <h2 class="text-xl font-medium mb-2 opacity-90">
              {#if name}¡Hola, {name}!{:else}Tu saldo actual{/if}
            </h2>
            <p class="text-5xl font-bold mb-2">{formatCurrency(balance)}</p>
            <div class="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm opacity-90">Actualizado al último movimiento</span>
            </div>
          </div>
        </div>

        <!-- Transacciones -->
        {#if transactions.length > 0}
          <div class="bg-white rounded-2xl shadow-lg border border-[#35528C]/10 overflow-hidden">
            <div class="p-6 border-b border-gray-100">
              <h3 class="text-xl font-semibold text-[#35528C]">Últimos 10 Movimientos</h3>
              <p class="text-sm text-gray-600 mt-1">Mostrando las últimas 10 transacciones de tu cuenta</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-[#35528C]/5">
                  <tr>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Fecha</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Hora</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Tipo</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Cantidad</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Método</th>
                    <th class="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[#35528C]">Observaciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each transactions as transaction}
                    <tr class="hover:bg-[#35528C]/5 transition-colors duration-150">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {transaction.dateOnly}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.timeOnly}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class={transaction.amount >= 0 ? 
                          'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium' : 
                          'bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium'}>
                          {transaction.amount >= 0 ? 'Recarga' : 'Consumo'}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class={transaction.amount >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                          {formatCurrency(Math.abs(cleanNumber(transaction.amount)))}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-[#35528C]/10 text-[#35528C]">
                          {transaction.method || '-'}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {#if transaction.notes && transaction.notes.includes('Compra #')}
                          {@const orderNumber = transaction.notes.match(/Compra #(\d+)/)?.[1]}
                          {#if orderNumber}
                            <a href={`/voucher/${orderNumber}`} target="_blank" class="text-blue-600 underline hover:text-blue-800">
                              {transaction.notes}
                            </a>
                          {:else}
                            {transaction.notes || '-'}
                          {/if}
                        {:else}
                          {transaction.notes || '-'}
                        {/if}
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
</div>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }
</style>

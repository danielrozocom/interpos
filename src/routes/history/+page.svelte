<script lang="ts">
import { onMount } from 'svelte';

let userId = '';
let userName = '';
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];
let transactions: Array<any> = [];
let loading = false;
let error = '';
let step = 1;

// Función para validar que solo se ingresen números en el ID
function validateNumericInput(event: KeyboardEvent) {
  const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  if (allowedKeys.includes(event.key)) {
    return; // Permitir teclas de navegación
  }
  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault(); // Bloquear cualquier carácter que no sea número
  }
}

// Función para limpiar caracteres no numéricos del valor pegado
function cleanPastedValue(event: ClipboardEvent) {
  event.preventDefault();
  const pastedText = event.clipboardData?.getData('text') || '';
  const numericOnly = pastedText.replace(/[^0-9]/g, '');
  userId = numericOnly;
}


function cleanNumber(str: string | number): number {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  // Elimina $ y comas, conserva el signo
  return Number(str.replace(/[^\d.-]/g, ''));
}

function formatCurrency(val: number): string {
  return `$${(isNaN(val) ? 0 : Math.round(val * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function updateSuggestions() {
  if (!userId) {
    userSuggestions = [];
    return;
  }
  userSuggestions = allUsers.filter(u => u.id.includes(userId));
}

async function fetchTransactions() {
  loading = true;
  error = '';
  transactions = [];
  try {
    const res = await fetch(`/api/sheets/history?userId=${userId}`);
    if (!res.ok) throw new Error('No se pudo obtener el historial');
    transactions = await res.json();
    const user = allUsers.find(u => u.id === userId);
    userName = user ? user.name : '';
    step = 2;
  } catch (e) {
    error = 'Error al consultar el historial.';
  }
  loading = false;
}

$: userId, updateSuggestions();

</script>

<h1>Historial de Transacciones</h1>
{#if step === 1}
  <form on:submit|preventDefault={fetchTransactions}>
    <label>
      Ingrese ID de usuario:
      <input 
        type="text" 
        bind:value={userId} 
        required 
        list="user-suggestions" 
        on:keydown={(e) => {
          validateNumericInput(e);
          if (e.key === 'Enter') {
            if (allUsers.some(u => u.id === userId)) {
              fetchTransactions();
              e.preventDefault();
            } else {
              alert('No existe un usuario con ese ID');
              e.preventDefault();
            }
          }
        }}
        on:paste={cleanPastedValue}
        placeholder="Ingrese ID"
      />
      <datalist id="user-suggestions">
        {#each userSuggestions as u}
          <option value={u.id}>{u.name}</option>
        {/each}
      </datalist>
    </label>
    <ul>
      {#each userSuggestions as u}
        <li>
          <button 
            type="button"
            on:click={() => { userId = u.id; fetchTransactions(); }}
            style="background: none; border: none; padding: 0; text-align: left; cursor: pointer; text-decoration: underline; color: blue;"
          >
            {u.id} - {u.name}
          </button>
        </li>
      {/each}
    </ul>
    <button type="submit" disabled={!allUsers.some(u => u.id === userId) || loading}>Consultar</button>
  </form>
{/if}

{#if step === 2}
  <p>Usuario: <b>{userName}</b></p>
  <p>ID: <b>{userId}</b></p>
  <button on:click={() => { step = 1; transactions = []; userId = ''; userName = ''; }}>Nueva consulta</button>
  {#if transactions.length === 0}
    <p>No hay transacciones para este usuario.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Cantidad</th>
          <th>Saldo anterior</th>
          <th>Nuevo saldo</th>
          <th>Método</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        {#each transactions as t}
          <tr>
            <td>{t.Date}</td>
            <td>{t.Quantity !== undefined && t.Quantity !== null && t.Quantity !== '' && !isNaN(cleanNumber(t.Quantity)) ? formatCurrency(cleanNumber(t.Quantity)) : '-'}</td>
            <td>{t.PrevBalance !== undefined && t.PrevBalance !== null && t.PrevBalance !== '' && !isNaN(cleanNumber(t.PrevBalance)) ? formatCurrency(cleanNumber(t.PrevBalance)) : '-'}</td>
            <td>{t.NewBalance !== undefined && t.NewBalance !== null && t.NewBalance !== '' && !isNaN(cleanNumber(t.NewBalance)) ? formatCurrency(cleanNumber(t.NewBalance)) : '-'}</td>
            <td>{t.Method}</td>
            <td>{t["Observation(s)"]}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

{#if error}
  <p style="color:red">{error}</p>
{/if}

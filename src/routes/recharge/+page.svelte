<script lang="ts">
import { rechargeBalance } from '$lib/recharge';
import { onMount } from 'svelte';



let userId = '';
let userName = '';
let quantity: number = 0;
let method = '';
let observations = '';
let message = '';
let loading = false;
let currentBalance: number | null = null;
let userExists: boolean = false;
let step = 1;
let allUsers: Array<{id: string, name: string}> = [];
let userSuggestions: Array<{id: string, name: string}> = [];

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

async function fetchBalance() {
  if (!userId) {
    currentBalance = null;
    return;
  }
  try {
    const res = await fetch('/api/sheets/users');
    const users = await res.json();
    const user = users.find((u: any) => u.id === userId);
    if (user) {
      userExists = true;
      userName = user.name ?? '';
      let balance = user.balance !== undefined && user.balance !== '' && !isNaN(Number(user.balance)) ? Number(user.balance) : 0;
      currentBalance = balance;
    } else {
      userExists = false;
      userName = '';
      currentBalance = null;
    }
  } catch {
    currentBalance = null;
  }
}

$: userId, updateSuggestions();
$: userId, step === 2 && fetchBalance();

async function updateUserBalance(userId: string, newBalance: number) {
  await fetch('/api/sheets/users/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newBalance })
  });
}

async function handleSubmit() {
  loading = true;
  message = '';
  try {
    const oldBalance = currentBalance ?? 0;
    const newBalance = oldBalance + Number(quantity);
    await rechargeBalance({ userId, quantity, newBalance, method, observations });
    await updateUserBalance(userId, newBalance);
    message = `El usuario ${userName} (${userId}) tenía ${formatCurrency(oldBalance)} y ahora tiene ${formatCurrency(newBalance)}.`;
    // Limpiar campos
    userId = '';
    userName = '';
    quantity = 0;
    method = '';
    observations = '';
    currentBalance = null;
    step = 1;
  } catch (error) {
    message = 'Error al registrar la recarga.';
  }
  loading = false;
}
</script>

<h1>Recargar Saldo</h1>
{#if step === 1}
  <form on:submit|preventDefault={() => {
    if (allUsers.some(u => u.id === userId)) {
      step = 2;
    }
  }}>
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
              step = 2;
              e.preventDefault();
            } else {
              alert('No existe un usuario con ese ID');
              e.preventDefault();
            }
          }
        }}
        on:paste={cleanPastedValue}
        placeholder="Solo números"
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
            on:click={() => { userId = u.id; step = 2; }}
            style="background: none; border: none; padding: 0; text-align: left; cursor: pointer; text-decoration: underline; color: blue;"
          >
            {u.id} - {u.name}
          </button>
        </li>
      {/each}
    </ul>
    <button type="submit" disabled={!allUsers.some(u => u.id === userId)}>Siguiente</button>
  </form>
{/if}

{#if step === 2}
  {#if userExists}
    <p>Usuario: <b>{userName}</b></p>
    <p>Saldo actual: <b>{formatCurrency(currentBalance ?? 0)}</b></p>
    <form on:submit|preventDefault={() => { step = 3; }}>
      <label>
        Cantidad:
        <input type="number" bind:value={quantity} required />
      </label>
      <button type="submit" disabled={isNaN(Number(quantity)) || Number(quantity) === 0}>Siguiente</button>
    </form>
  {:else}
    {#if userId && !allUsers.some(u => u.id === userId)}
      <p style="color:red">El usuario no existe.</p>
      <button on:click={() => { step = 1; }}>Volver</button>
    {/if}
  {/if}
{/if}

{#if step === 3}
  <p>Usuario: <b>{userName}</b></p>
  <p>Saldo actual: <b>{formatCurrency(currentBalance ?? 0)}</b></p>
  <p>Cantidad: <b>{formatCurrency(Number(quantity))}</b></p>
  <p>Nuevo saldo: <b>{formatCurrency((currentBalance ?? 0) + (isNaN(Number(quantity)) ? 0 : Number(quantity)))}</b></p>
  <form on:submit|preventDefault={() => { step = 4; }}>
    {#if Number(quantity) > 0}
      <label>
        Método:
        <input type="text" bind:value={method} required />
      </label>
    {/if}
    <label>
      Observaciones:
      <input type="text" bind:value={observations} required={Number(quantity) < 0} />
    </label>
    <button type="submit" disabled={Number(quantity) > 0 ? !method : false}>Siguiente</button>
  </form>
  <button on:click={() => { step = 2; }}>Volver</button>
{/if}

{#if step === 4}
  <p>Usuario: <b>{userName}</b></p>
  <p>Saldo anterior: <b>{formatCurrency(currentBalance ?? 0)}</b></p>
  <p>Cantidad: <b>{formatCurrency(Number(quantity))}</b></p>
  <p>Nuevo saldo: <b>{formatCurrency((currentBalance ?? 0) + (isNaN(Number(quantity)) ? 0 : Number(quantity)))}</b></p>
  {#if Number(quantity) > 0}
    <p>Método: <b>{method}</b></p>
  {/if}
  <p>Observaciones: <b>{observations}</b></p>
  <form on:submit|preventDefault={handleSubmit}>
    <button type="submit" disabled={loading ? true : false}>Confirmar y registrar</button>
  </form>
  <button on:click={() => { step = 3; }}>Volver</button>
{/if}

{#if message}
  <p>{message}</p>
{/if}

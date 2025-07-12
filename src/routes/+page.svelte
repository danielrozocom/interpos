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
    return `$${(isNaN(val) ? 0 : Math.round(val * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  onMount(fetchUsers);
</script>

<h1>Bienvenid@ a InterPOS</h1>

<div class="dashboard">
  <div class="actions">
    <h2>Acciones rápidas</h2>
    <a href="/recharge" class="action-button">💰 Recargar Saldo</a>
    <a href="/history" class="action-button">📋 Ver Historial</a>
  </div>

  <div class="users-overview">
    <h2>Resumen de Usuarios</h2>
    {#if loading}
      <p>Cargando usuarios...</p>
    {:else if users.length === 0}
      <p>No hay usuarios registrados.</p>
    {:else}
      <div class="users-grid">
        {#each users as user}
          <div class="user-card">
            <h3>ID: {user.id}</h3>
            <p><strong>{user.name}</strong></p>
            <p class="balance">Saldo: {formatCurrency(user.balance)}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .actions {
    margin-bottom: 30px;
  }

  .action-button {
    display: inline-block;
    background: #007bff;
    color: white;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 8px;
    margin-right: 15px;
    font-weight: bold;
    transition: background-color 0.3s;
  }

  .action-button:hover {
    background: #0056b3;
  }

  .users-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 15px;
  }

  .user-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
    background: #f9f9f9;
  }

  .user-card h3 {
    margin: 0 0 10px 0;
    color: #333;
  }

  .user-card p {
    margin: 5px 0;
  }

  .balance {
    font-size: 1.1em;
    color: #28a745;
    font-weight: bold;
  }
</style>

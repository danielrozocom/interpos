<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  const roles = writable([] as any[]);
  const emails = writable([] as any[]);

  const load = async () => {
    const r = await fetch('/api/admin/roles');
    const jr = await r.json();
    roles.set(jr.roles || []);

    const e = await fetch('/api/admin/allowed-emails');
    const je = await e.json();
    emails.set(je.emails || []);
  };

  onMount(load);

  let newRoleName = '';
  let newRolePermissions = '{}';
  let newEmail = '';
  let newEmailRole = '';
  let editingRoleId: string | null = null;
  let editingRoleName = '';
  let editingRolePermissions = '{}';

  async function createRole() {
    try {
      const res = await fetch('/api/admin/roles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: newRoleName, permissions: JSON.parse(newRolePermissions || '{}') }) });
      const j = await res.json();
      if (j.role) {
        newRoleName = '';
        newRolePermissions = '{}';
        load();
      } else alert(j.error || 'Error');
    } catch (err) { alert('Invalid permissions JSON'); }
  }

  async function deleteRole(id: any) {
    if (!confirm('Eliminar rol?')) return;
    await fetch('/api/admin/roles', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  async function startEditRole(role: any) {
    editingRoleId = role.id;
    editingRoleName = role.name;
    editingRolePermissions = JSON.stringify(role.permissions || {}, null, 2);
  }

  async function cancelEdit() {
    editingRoleId = null;
    editingRoleName = '';
    editingRolePermissions = '{}';
  }

  async function saveEdit() {
    if (!editingRoleId) return;
    try {
      const res = await fetch('/api/admin/roles', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: editingRoleId, name: editingRoleName, permissions: JSON.parse(editingRolePermissions || '{}') }) });
      const j = await res.json();
      if (j.role) {
        cancelEdit();
        load();
      } else alert(j.error || 'Error');
    } catch (err) { alert('Invalid permissions JSON'); }
  }

  async function addEmail() {
    const res = await fetch('/api/admin/allowed-emails', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: newEmail, role_id: newEmailRole || null }) });
    const j = await res.json();
    if (j.email) { newEmail = ''; newEmailRole = ''; load(); } else alert(j.error || 'Error');
  }

  async function deleteEmail(id: any) {
    if (!confirm('Eliminar email?')) return;
    await fetch('/api/admin/allowed-emails', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }
</script>

<h1 class="text-2xl font-bold mb-4">Administración - Roles y Emails autorizados</h1>

<section class="mb-8">
  <h2 class="text-xl font-semibold">Roles</h2>
  <div class="mb-2">
    <input placeholder="Nombre rol" bind:value={newRoleName} class="mr-2" />
  <input placeholder="Permisos JSON (ej: &#123;&quot;products&quot;: true&#125;)" bind:value={newRolePermissions} class="mr-2" />
    <button on:click={createRole} class="btn">Crear rol</button>
  </div>
  <div>
    {#each $roles as role}
      <div class="p-2 border rounded mb-2">
        {#if editingRoleId === role.id}
          <div class="mb-2">
            <input bind:value={editingRoleName} class="mr-2" />
            <button on:click={saveEdit} class="btn">Guardar</button>
            <button on:click={cancelEdit} class="btn btn-danger">Cancelar</button>
          </div>
          <textarea bind:value={editingRolePermissions} rows={4} class="w-full p-1 text-sm"></textarea>
        {:else}
          <div><strong>{role.name}</strong> <small class="text-gray-500">id: {role.id}</small></div>
          <pre class="text-sm">{JSON.stringify(role.permissions || {}, null, 2)}</pre>
          <div class="mt-2">
            <button on:click={() => startEditRole(role)} class="btn mr-2">Editar</button>
            <button on:click={() => deleteRole(role.id)} class="btn btn-danger">Eliminar</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</section>

<section>
  <h2 class="text-xl font-semibold">Emails autorizados</h2>
  <div class="mb-2">
    <input placeholder="email@dominio.com" bind:value={newEmail} class="mr-2" />
    <select bind:value={newEmailRole} class="mr-2">
      <option value="">(sin rol)</option>
      {#each $roles as r}
        <option value={r.id}>{r.name}</option>
      {/each}
    </select>
    <button on:click={addEmail} class="btn">Agregar email</button>
  </div>
  <div>
    {#each $emails as e}
      <div class="p-2 border rounded mb-2">
        <div>{e.email} <small class="text-gray-500">{e.role_id ? `-> role ${e.role_id}` : ''}</small></div>
        <button on:click={() => deleteEmail(e.id)} class="btn btn-danger">Eliminar</button>
      </div>
    {/each}
  </div>
</section>

<style>
  .btn { background:#35528C; color:#fff; padding:6px 10px; border-radius:6px; }
  .btn-danger { background:#c0392b; color:#fff; padding:6px 10px; border-radius:6px; }
</style>

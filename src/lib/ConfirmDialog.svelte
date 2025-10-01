<script lang="ts">
  import Modal from './Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  export let open = false;
  export let title = 'Confirmar';
  // Default consistent delete confirmation text (Spanish)
  export let message = '';
  // optional item name (rendered bold) and extra label text
  export let itemName: string | null = null;
  export let itemLabel: string | null = null;
  export let confirmLabel = 'Eliminar';
  export let cancelLabel = 'Cancelar';
  const dispatch = createEventDispatcher();

  function onClose(e: any) {
    open = false;
    dispatch('cancel');
  }

  function confirm() {
    open = false;
    dispatch('confirm');
  }

</script>

<!-- Ensure confirm dialogs always appear above other modals by using a large zOffset -->
<Modal {open} {title} on:close={onClose} zOffset={100000}>
  <div class="p-2">
    {#if message}
      <p class="mb-4">{message}</p>
    {:else if itemName}
      <p class="mb-4">¿Seguro que deseas eliminar <strong>{itemName}</strong>{itemLabel ? ` ${itemLabel}` : ''}? Esta acción no se puede deshacer.</p>
    {:else if itemLabel}
      <p class="mb-4">¿Seguro que deseas eliminar <strong>{itemLabel}</strong>? Esta acción no se puede deshacer.</p>
    {:else}
      <p class="mb-4">¿Estás seguro que deseas eliminar este elemento?</p>
    {/if}
    <div class="flex justify-end gap-2">
      <button class="btn-secondary" on:click={onClose}>{cancelLabel}</button>
      <button class="btn-primary" on:click={confirm}>{confirmLabel}</button>
    </div>
  </div>
</Modal>

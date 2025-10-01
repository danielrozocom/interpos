<script lang="ts">
  import Modal from './Modal.svelte';
  import { createEventDispatcher } from 'svelte';
  export let open = false;
  export let title = 'Confirmar';
  export let message = '';
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

<Modal {open} {title} on:close={onClose}>
  <div class="p-2">
    <p class="mb-4">{message}</p>
    <div class="flex justify-end gap-2">
      <button class="btn-secondary" on:click={onClose}>Cancelar</button>
      <button class="btn-primary" on:click={confirm}>Confirmar</button>
    </div>
  </div>
</Modal>

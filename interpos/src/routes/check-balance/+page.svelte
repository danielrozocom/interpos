```svelte
<script>
  let Scanner;
  let showScanner = false;
  let scannerError = '';

  function openScanner() {
    // Si el componente no está cargado aún, cargarlo bajo demanda
    if (!Scanner) {
      scannerError = 'Cargando escáner...';
      console.log('Cargando Scanner dinámicamente...');
      // intentar carga dinámica sin bloquear UI
      import('../../lib/Scanner.svelte').then(m => {
        Scanner = m.default;
        scannerError = '';
        showScanner = true;
        console.log('Scanner cargado, mostrando modal');
      }).catch(err => {
        console.error('Error cargando Scanner dinámicamente', err);
        scannerError = 'Escáner no disponible';
      });
      return;
    }

    // Mostrar el modal; el componente inicia automáticamente al montarse
    scannerError = '';
    showScanner = true;
  }
</script>

<div>
  <!-- Botón principal de escaneo -->
  <div class="flex items-center">
    <button
      type="button"
      class="h-10 px-4 rounded-lg flex items-center justify-center bg-[#35528C] text-white shadow-sm hover:bg-[#2A4170] focus:outline-none focus:ring-2 focus:ring-[#35528C]/40"
      aria-label="Abrir escáner de código QR o código de barras"
      title="Escanear código"
      on:click={() => openScanner()}
    >
      <!-- icono de escáner (SVG) -->
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 7h3l2-2h6l2 2h3v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <circle cx="12" cy="13" r="3.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
  <!-- Mensaje de error del escáner -->
  {#if scannerError}
    <div class="text-sm text-red-600 mt-2">{scannerError}</div>
  {/if}
</div>

{#if showScanner}
  <Scanner on:close={() => showScanner = false} />
{/if}
```
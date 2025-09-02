<script lang="ts">
  /*
    Modal Scanner.svelte
    - Modal centrado que inicia el escaneo al montarse
    - Usa @zxing/browser import dinámico en start()
    - No permite subir imágenes
    - Emite: scanned {userId, raw, payload}, error, status
    - Expose: start, stop, reinit (por bind:this si el padre quiere)
  */
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  // single storage key for preferred camera
  const PREF_KEY = 'scanner.preferredDeviceId';

  const dispatch = createEventDispatcher();

  // Props
  export let deviceId: string | undefined = undefined; // id preferida
  export let continuous: boolean = false; // si true, sigue escaneando
  export let debounceMs: number = 800; // debounce en modo continuo
  export const formats: string[] = [
    'qr_code','code_128','ean_13','ean_8','upc_a','upc_e','codabar','itf','data_matrix','pdf417','aztec'
  ];
  export let transform: ((raw: string) => { userId: string | null; payload?: any }) | undefined = undefined;
  // Configurable validation for the numeric ID extracted from codes
  // Defaults: accept between 2 and 13 digits (covers short codes like 777 and barcode EAN13)
  export let minIdDigits: number = 2;
  export let maxIdDigits: number = 13;

  // Estado interno
  let videoEl: HTMLVideoElement | null = null;
  let _codeReader: any = null; // instancia de BrowserMultiFormatReader
  let _zxingLoaded = false;
  let _lastEmitted: string | null = null;
  let _debounceTimer: any = null;
  let _activeDeviceId: string | null = deviceId || null;

  // Si el prop deviceId cambia desde el padre, actualizar el device activo
  $: if (typeof window !== 'undefined' && deviceId) {
    _activeDeviceId = deviceId;
  }

  // Debugging and device selection helpers
  let lastRaw: string | null = null;
  let lastError: string | null = null;
  let _deviceList: MediaDeviceInfo[] = [];
  let _activeLabel: string | null = null;

  function savePreferredDevice(deviceId: string | null) {
    try {
      if (deviceId) window.localStorage.setItem(PREF_KEY, deviceId);
      else window.localStorage.removeItem(PREF_KEY);
    } catch (e) {
      console.warn('No se pudo guardar preferencia de cámara', e);
    }
  }

  function loadPreferredDevice(): string | null {
    try {
      return window.localStorage.getItem(PREF_KEY);
    } catch (e) {
      return null;
    }
  }

  // Permission handling: track when permission is denied or stream becomes inactive
  let permissionDenied: boolean = false;
  let permissionMessage: string | null = null;

  async function requestCameraPermission(constraints: any = { video: true }) {
    // Try to trigger permission prompt and immediately close stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // stop tracks immediately (we only wanted to request permission)
      try { stream.getTracks().forEach(t => t.stop()); } catch (_) {}
      permissionDenied = false;
      permissionMessage = null;
      return true;
    } catch (permErr) {
      // mark as denied and store message
      permissionDenied = true;
      permissionMessage = (permErr && (permErr as any).message) ? (permErr as any).message : String(permErr);
      console.warn('Permission request failed', permErr);
      return false;
    }
  }

  function handleStreamInactive() {
    // Called when stream becomes inactive; try to surface UI to re-request permission
    permissionDenied = true;
    permissionMessage = 'La cámara se ha detenido o perdido. Reintente permisos.';
    dispatch('status', 'Camera inactive');
    dispatch('error', permissionMessage);
  }

  async function onSelectChange() {
    // persist and reinit scanner with selected device
    try {
      savePreferredDevice(_activeDeviceId);
      await reinit(_activeDeviceId || undefined);
    } catch (e) {
      console.warn('Error cambiando cámara', e);
    }
  }

  async function listCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      _deviceList = devices.filter(d => d.kind === 'videoinput');
      if (_deviceList.length > 0) {
        // Elegir la trasera por defecto si no hay _activeDeviceId
        if (!_activeDeviceId) {
          const rear = pickRearCamera(_deviceList);
          if (rear) _activeDeviceId = rear;
        }
        const active = _deviceList.find(d => d.deviceId === _activeDeviceId) || _deviceList[0];
        _activeLabel = active.label || `Cámara ${_deviceList.indexOf(active) + 1}`;
      } else {
        _activeLabel = null;
      }
    } catch (e) {
      console.warn('No se pudieron listar cámaras', e);
    }
  }

  function pickRearCamera(vids: MediaDeviceInfo[]): string | null {
    if (!vids || vids.length === 0) return null;
    // Prefer labels that indicate back/rear/environment (multi-language)
    const re = /rear|back|environment|trasera|posterior|trase|trasero/i;
    const match = vids.find(v => v.label && re.test(v.label));
    if (match) return match.deviceId || null;
    // Fallback: many mobile devices expose rear camera as the last device
    return vids[vids.length - 1].deviceId || null;
  }

  async function cycleCamera() {
    if (!_deviceList || _deviceList.length <= 1) return;
    const idx = _deviceList.findIndex(d => d.deviceId === _activeDeviceId);
    const next = _deviceList[(idx + 1) % _deviceList.length];
    _activeDeviceId = next.deviceId;
    _activeLabel = next.label || `Cámara ${(_deviceList.indexOf(next) + 1)}`;
    // restart scanner with new device
    await reinit(_activeDeviceId || undefined);
    // guardar preferencia en localStorage
    try { savePreferredDevice(_activeDeviceId); } catch (e) { console.warn('No se pudo guardar la preferencia de cámara', e); }
  }

  // Helpers SSR-safe: no usar nada de navigator/window fuera de onMount/start

  // start(): inicia o reinicia con la cámara current
  export async function start(): Promise<void> {
    if (typeof window === 'undefined') return; // SSR safety
    dispatch('status', 'Inicializando cámara...');

    try {
      // Cargar ZXing dinámicamente (lazy)
      if (!_zxingLoaded) {
        try {
          // import dinámico dentro del cliente
          const zxing = await import('@zxing/browser');
          const lib = await import('@zxing/library');
          const { BrowserMultiFormatReader } = zxing;

          // Construir hints para forzar formatos (incluye EANs)
          const { DecodeHintType, BarcodeFormat } = lib;
          const possibleFormats: any[] = [];

          // Mapear strings de `formats` a BarcodeFormat enums
          for (const f of formats) {
            switch ((f || '').toLowerCase()) {
              case 'qr_code': possibleFormats.push(BarcodeFormat.QR_CODE); break;
              case 'code_128': possibleFormats.push(BarcodeFormat.CODE_128); break;
              case 'ean_13': possibleFormats.push(BarcodeFormat.EAN_13); break;
              case 'ean_8': possibleFormats.push(BarcodeFormat.EAN_8); break;
              case 'upc_a': possibleFormats.push(BarcodeFormat.UPC_A); break;
              case 'upc_e': possibleFormats.push(BarcodeFormat.UPC_E); break;
              case 'codabar': possibleFormats.push(BarcodeFormat.CODABAR); break;
              case 'itf': possibleFormats.push(BarcodeFormat.ITF); break;
              case 'data_matrix': possibleFormats.push(BarcodeFormat.DATA_MATRIX); break;
              case 'pdf417': possibleFormats.push(BarcodeFormat.PDF_417); break;
              case 'aztec': possibleFormats.push(BarcodeFormat.AZTEC); break;
              default: break;
            }
          }

          const hints = new Map();
          if (possibleFormats.length > 0) hints.set(DecodeHintType.POSSIBLE_FORMATS, possibleFormats);

          _codeReader = new BrowserMultiFormatReader();

          // Attempt to set hints on the reader in several possible APIs
          try {
            if (typeof (_codeReader as any).setHints === 'function') {
              (_codeReader as any).setHints(hints);
            } else if ((_codeReader as any).hints !== undefined) {
              (_codeReader as any).hints = hints;
            } else if ((_codeReader as any).reader && typeof (_codeReader as any).reader.setHints === 'function') {
              (_codeReader as any).reader.setHints(hints);
            }
          } catch (hintErr) {
            // no fatal, continuar sin hints
            console.warn('No se pudo aplicar hints en ZXing reader', hintErr);
          }

          _zxingLoaded = true;
        } catch (impErr) {
          console.error('Error cargando @zxing/browser', impErr);
          dispatch('error', 'No se pudo cargar el motor de escaneo');
          dispatch('status', 'Error');
          return;
        }
      }

      // Determinar dispositivo
      let useDeviceId = _activeDeviceId;
      if (!useDeviceId) {
        // intentar listar cámaras y elegir la primera
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const vids = devices.filter(d => d.kind === 'videoinput');
          if (vids.length > 0) {
            useDeviceId = vids[0].deviceId || null;
            _activeDeviceId = useDeviceId;
          } else {
            dispatch('error', 'No se encontraron cámaras disponibles');
            dispatch('status', 'No hay cámaras');
            return;
          }
        } catch (devErr) {
          console.error('Error enumerando dispositivos', devErr);
          dispatch('error', 'No se pudieron listar las cámaras');
          dispatch('status', 'Error');
          return;
        }
      }

      // Asegurar que hay un elemento video
      if (!videoEl) {
        dispatch('error', 'Elemento de video no disponible');
        return;
      }

      dispatch('status', 'Solicitando permiso de cámara...');

      // Usamos decodeFromVideoDevice que internamente abre la cámara
      try {
        // reset previo si existía
        try { _codeReader?.reset(); } catch(e) {}

        // iniciar decodificación: callback cada vez que ZXing detecta algo
        await _codeReader.decodeFromVideoDevice(useDeviceId, videoEl, (result: any, error: any, controls?: any) => {
          // controls puede contener stop(), restart(), etc. Detener con controls.stop() si es necesario
          if (error && !result) {
            // errores frecuentes: No hay frame, timeouts, etc. No emitimos de inmediato.
            return;
          }

          if (result) {
            const raw = typeof result.getText === 'function' ? result.getText() : String(result);
            lastRaw = raw;
            lastError = null;

            // transformar
            let userId: string | null = null;
            let payload: any = undefined;

            if (transform) {
              try {
                const out = transform(raw);
                userId = out?.userId ?? null;
                payload = out?.payload;
              } catch (tErr) {
                console.error('Error en transform function', tErr);
                dispatch('error', 'Transformación del código falló');
                return;
              }
            } else {
              // Normalización por defecto: trim, quitar prefijos típicos, validar con regex (6-10 dígitos)
              let candidate = raw.trim();
              candidate = candidate.replace(/^(ID:|ID=|STU-|USER-|USR-|UID:)/i, '');
              candidate = candidate.replace(/[^0-9]/g, '');
              if (new RegExp(`^\\d{${minIdDigits},${maxIdDigits}}$`).test(candidate)) {
                userId = candidate;
              } else {
                userId = null;
              }
            }

            if (!userId) {
              dispatch('error', 'No se encontró un ID válido en el código leído');
              return;
            }

            // Manejar emisión según continuous y debounce
            const now = Date.now();
            if (continuous) {
              if (_lastEmitted === userId) {
                // mismo valor; ignorar
                return;
              }

              // emitir y establecer debounce
              dispatch('scanned', { userId, raw, payload });
              _lastEmitted = userId;

              // limpiar _lastEmitted después de debounceMs
              if (_debounceTimer) clearTimeout(_debounceTimer);
              _debounceTimer = setTimeout(() => { _lastEmitted = null; _debounceTimer = null; }, debounceMs);
              dispatch('status', 'Escaneando...');
              // no detener
            } else {
              // emitir y detener
              dispatch('scanned', { userId, raw, payload });
              dispatch('status', 'Lectura completada');
              // detener ZXing y cámara
              try {
                // si controls existe y tiene stop, usarlo
                if (controls && typeof controls.stop === 'function') {
                  try { controls.stop(); } catch(e) {}
                }
                stop();
              } catch (stopErr) {
                // fallback
                stop();
              }
            }
          } else if (error) {
            // Log debug info for why decode failed on frames
            const msg = error && (error as any).message ? (error as any).message : String(error);
            lastError = msg;
            console.debug('zxing frame error', msg);
          }
        });

        // populate device list and label for UI
        try { await listCameras(); } catch(e){}
        dispatch('status', 'Escaneando...');
      } catch (startErr) {
        console.error('Error iniciando decodeFromVideoDevice', startErr);
        // detectar permiso denegado de forma segura
        if (startErr && typeof startErr === 'object' && 'name' in (startErr as any) && (startErr as any).name === 'NotAllowedError') {
          dispatch('error', 'Permiso de cámara denegado');
          dispatch('status', 'Permission denied');
          return;
        } else {
          dispatch('error', 'No se pudo iniciar la cámara');
          dispatch('status', 'Error');
        }
      }

    } catch (err) {
      console.error('Error en start()', err);
      dispatch('error', 'Error al inicializar el escáner');
      dispatch('status', 'Error');
    }
  }

  // stop(): detiene cámara y ZXing, libera recursos
  export function stop(): void {
    try {
      // reset ZXing
      try { _codeReader?.reset(); } catch (e) {}
      _codeReader = _codeReader; // keep reference
    } catch (e) {
      // ignore
    }

    // detener tracks del video element si hay stream
    try {
      const stream = (videoEl && (videoEl.srcObject as MediaStream)) || null;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (videoEl) videoEl.srcObject = null;
    } catch (e) {
      // ignore
    }

    // limpiar timers
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    _lastEmitted = null;

    dispatch('status', 'Detenido');
  }

  // reinit(newDeviceId?): cambia cámara y reinicia
  export async function reinit(newDeviceId?: string): Promise<void> {
    // detener primero
    stop();
    if (newDeviceId) {
      _activeDeviceId = newDeviceId;
    }
    await start();
  }

  function closeModal() {
    try { stop(); } catch(e) {}
    dispatch('close');
  }

  // iniciar automáticamente cuando se monta en cliente
  onMount(() => {
    if (typeof window !== 'undefined') {
      const pref = loadPreferredDevice();
      if (pref) _activeDeviceId = pref;
      start();
    }

    // cerrar con Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    onDestroy(() => { window.removeEventListener('keydown', onKey); });
  });

  // limpiar al destruir componente
  onDestroy(() => {
    try { stop(); } catch (e) {}
  });
</script>

<style>
  /* backdrop con padding para dejar margen en móviles */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:50;
    padding: 16px; /* espacio lateral en móviles */
    box-sizing: border-box;
  }

  /* caja responsiva: no superar 92% del ancho de la pantalla */
  .modal-box {
    width: min(92vw, 420px); /* ajusta automáticamente a pantallas pequeñas */
    max-width: 100%;
    margin: 0 auto;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    box-sizing: border-box;
  }

  .modal-header {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:12px 16px;
    background:#f3f4f6;
    border-bottom:1px solid #e5e7eb;
  }

  .modal-title { font-weight:600; color:#111827; }

  .header-left { display:flex; align-items:center; gap:12px; flex:1; }

  .modal-body {
    background:black;
    height: min(56vh, 360px); /* altura responsiva */
    display:flex;
    align-items:center;
    justify-content:center;
    position:relative;
    overflow: hidden; /* importante: recortar el video al contenedor */
  }

  /* el video ocupa todo el contenedor y se recorta (no permite salirse) */
  video {
    width: 100%;
    height: 100%;
    object-fit: cover; /* cover mejor para lecturas de barras */
    display: block;
    max-height: 100%;
  }

  .close-btn { background:transparent; border:0; font-size:18px; cursor:pointer; margin-left: 12px; }

  /* debug reducido: menos intrusivo y abajo a la izquierda */
  .debug-info {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 6px 10px;
    font-size: 12px;
    color: white;
    background: rgba(0, 0, 0, 0.55);
    border-radius: 6px;
    z-index: 100;
    max-width: calc(100% - 16px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* style for select in header to look decent */
  select[aria-label="Seleccionar cámara"] {
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid #d1d5db;
    background: white;
    color: #111827;
    font-size: 14px;
  }

  /* nuevo estilo para el header del modal: mayor separación y alineación */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
  }

  @media (min-width: 900px) {
    .modal-box { width: 560px; }
    .modal-body { height: 420px; }
  }

  /* nuevo estilo para el panel de permisos */
  .permission-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
    z-index: 200;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 10px;
  }

  .permission-panel button {
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    border: none;
    transition: background 0.3s;
  }

  .permission-panel button:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>

<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Escáner de códigos">
  <div class="modal-box">
    <div class="modal-header">
      <div class="header-left">
        <div class="modal-title">Escanear código</div>
        {#if _deviceList && _deviceList.length > 1}
          <select on:change={onSelectChange} bind:value={_activeDeviceId} aria-label="Seleccionar cámara">
            {#each _deviceList as d, i}
              <option value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>
            {/each}
          </select>
        {/if}
      </div>
      <button class="close-btn" aria-label="Cerrar escáner" on:click={closeModal}>✕</button>
    </div>
    <div class="modal-body">
      <video bind:this={videoEl} autoplay playsinline muted></video>
      {#if permissionDenied}
        <div class="permission-panel" role="alert">
          <div style="color:white; margin-bottom:8px;">{permissionMessage || 'Permiso de cámara denegado o cámara inactiva'}</div>
          <div style="display:flex; gap:8px;">
            <button on:click={async () => { const ok = await requestCameraPermission(); if (ok) { permissionDenied = false; start(); } }} style="padding:8px 10px; border-radius:6px; background:white; color:#111827;">Reintentar permisos</button>
            <button on:click={() => { location.reload(); }} style="padding:8px 10px; border-radius:6px; background:transparent; border:1px solid #fff; color:#fff;">Recargar página</button>
          </div>
        </div>
      {/if}
      <div class="debug-info">
        {#if lastRaw}
          Último raw: {lastRaw} {#if lastError} | Error: {lastError}{/if}
        {:else}
          Esperando escaneo...
        {/if}
        {#if _activeLabel}
          <br>Cámara: {_activeLabel}
        {/if}
      </div>
    </div>
  </div>
</div>

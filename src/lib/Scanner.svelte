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

  async function listCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      _deviceList = devices.filter(d => d.kind === 'videoinput');
      if (_deviceList.length > 0) {
        const active = _deviceList.find(d => d.deviceId === _activeDeviceId) || _deviceList[0];
        _activeLabel = active.label || `Cámara ${_deviceList.indexOf(active) + 1}`;
      } else {
        _activeLabel = null;
      }
    } catch (e) {
      console.warn('No se pudieron listar cámaras', e);
    }
  }

  async function cycleCamera() {
    if (!_deviceList || _deviceList.length <= 1) return;
    const idx = _deviceList.findIndex(d => d.deviceId === _activeDeviceId);
    const next = _deviceList[(idx + 1) % _deviceList.length];
    _activeDeviceId = next.deviceId;
    _activeLabel = next.label || `Cámara ${(_deviceList.indexOf(next) + 1)}`;
    // restart scanner with new device
    await reinit(_activeDeviceId || undefined);
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
      _codeReader = _codeReader; // keep reference if needed
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
    if (typeof window !== 'undefined') start();

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
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:50; }
  .modal-box { width: 420px; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
  .modal-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:#f3f4f6; border-bottom:1px solid #e5e7eb; }
  .modal-title { font-weight:600; color:#111827; }
  .modal-body { background:black; height:320px; display:flex; align-items:center; justify-content:center; }
  video { width:100%; height:100%; object-fit:contain; }
  .close-btn { background:transparent; border:0; font-size:18px; cursor:pointer; }
  .debug-info {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px;
    font-size: 14px;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
    z-index: 100;
  }
</style>

<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Escáner de códigos">
  <div class="modal-box">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="modal-title">Escanear código</div>
        {#if _deviceList && _deviceList.length > 1}
          <button on:click={cycleCamera} title="Cambiar cámara">📷</button>
        {/if}
      </div>
      <button class="close-btn" aria-label="Cerrar escáner" on:click={closeModal}>✕</button>
    </div>
    <div class="modal-body">
      <video bind:this={videoEl} autoplay playsinline muted></video>
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

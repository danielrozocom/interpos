<script lang="ts">
  import { page } from '$app/stores';
  import { siteName } from '../lib/config';

  // SvelteKit pasa el error automáticamente via $page.error y $page.status
  $: errorCode = $page.status || 500;
  $: errorMessage = $page.error?.message || 'Ha ocurrido un error inesperado';
  
  // Determinar el tipo de error y mensaje personalizado
  $: ({ title, description, actionText, actionIcon, bgColor, emoji } = getErrorDetails(errorCode));
  
  function getErrorDetails(code) {
    switch (code) {
      case 404:
        return {
          title: '¡Ups! Página no encontrada',
          description: 'La página que buscas no existe, ha sido movida o el enlace es incorrecto.',
          actionText: 'Volver al inicio',
          actionIcon: '🏠',
          bgColor: 'from-blue-50 to-indigo-50',
          emoji: '🔍'
        };
      case 500:
        return {
          title: 'Error del servidor',
          description: 'Ha ocurrido un error interno en el servidor. Nuestro equipo ha sido notificado.',
          actionText: 'Reintentar',
          actionIcon: '🔄',
          bgColor: 'from-red-50 to-pink-50',
          emoji: '🔧'
        };
      default:
        return {
          title: 'Error inesperado',
          description: 'Ha ocurrido un error. Por favor, inténtalo más tarde.',
          actionText: 'Volver al inicio',
          actionIcon: '⚠️',
          bgColor: 'from-gray-50 to-blue-50',
          emoji: '⚠️'
        };
    }
  }

  function handleAction() {
    if (typeof window === 'undefined') return;
    if (errorCode === 500) {
      window.location.reload();
    } else {
      window.location.href = '/';
    }
  }

  function goHome() {
    if (typeof window === 'undefined') return;
    window.location.href = '/';
  }

  function goBack() {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  }
</script>

<svelte:head>
  <title>{title} | {siteName}</title>
  <meta name="description" content={description} />
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br {bgColor} px-4">
  <div class="max-w-lg w-full text-center">
    <!-- Error Icon -->
    <div class="mb-8 animate-fade-in">
      <div class="w-32 h-32 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center border-4 {errorCode === 404 ? 'border-blue-200' : errorCode === 500 ? 'border-red-200' : 'border-yellow-200'}">
        <div class="text-6xl">{emoji}</div>
      </div>
    </div>

    <!-- Error Message -->
    <div class="mb-8 animate-slide-up">
      <h1 class="text-8xl font-bold mb-4 {errorCode === 404 ? 'text-blue-600 animate-bounce' : errorCode === 500 ? 'text-red-600 animate-pulse' : 'text-yellow-600'}">{errorCode}</h1>
      <h2 class="text-3xl font-bold text-gray-800 mb-4">{title}</h2>
      <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">{description}</p>
    </div>

    <!-- Action Buttons -->
    <div class="space-y-4 animate-slide-up" style="animation-delay: 0.2s;">
      <button 
        on:click={handleAction}
        class="block w-full px-8 py-4 bg-primary text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold text-lg"
      >
        {actionIcon} {actionText}
      </button>
      
      <button 
        on:click={goBack}
        class="block w-full px-8 py-4 bg-white text-gray-700 rounded-xl shadow-md hover:shadow-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 font-medium"
      >
        ← Volver atrás
      </button>
    </div>

    <!-- Navigation shortcuts for 404 -->
    {#if errorCode === 404}
      <div class="mt-8 grid grid-cols-2 gap-4 animate-slide-up" style="animation-delay: 0.4s;">
        <a href="/sell" class="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-center group">
          <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🛒</div>
          <div class="text-sm font-medium text-gray-700">Vender</div>
        </a>
        <a href="/recharge" class="p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-center group">
          <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">💳</div>
          <div class="text-sm font-medium text-gray-700">Recargar</div>
        </a>
      </div>
    {/if}

    <!-- Additional Help -->
    <div class="mt-8 p-6 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 animate-slide-up" style="animation-delay: 0.6s;">
      <div class="flex items-start space-x-3">
        <div class="text-2xl">💡</div>
        <div class="text-left">
          <p class="font-semibold text-gray-800 mb-2">¿Necesitas ayuda?</p>
          <p class="text-sm text-gray-600 leading-relaxed">
            {#if errorCode === 404}
              Verifica que la URL esté escrita correctamente o navega desde el menú principal.
            {:else if errorCode === 500}
              Si el problema persiste, por favor contacta al administrador del sistema.
            {:else}
              Si el problema persiste, por favor contacta al soporte técnico.
            {/if}
          </p>
        </div>
      </div>
    </div>

    <!-- Technical Details (for debugging - only for server errors) -->
    {#if errorCode >= 500}
      <details class="mt-6 text-left animate-slide-up" style="animation-delay: 0.8s;">
        <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">Información técnica</summary>
        <div class="mt-3 p-4 bg-gray-900 rounded-lg text-xs font-mono text-green-400 overflow-x-auto">
          <div class="space-y-1">
            <p><span class="text-gray-500">Error:</span> {errorCode} - {errorMessage}</p>
            <p><span class="text-gray-500">Timestamp:</span> {new Date().toISOString()}</p>
            <p><span class="text-gray-500">URL:</span> {$page.url.pathname}</p>
          </div>
        </div>
      </details>
    {/if}
  </div>
</div>
  <div class="max-w-lg w-full text-center">
    <!-- Error Icon -->
    <div class="mb-8 animate-fade-in">
      <div class="w-32 h-32 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center border-4 border-red-200">
        <div class="text-6xl"></div>
      </div>
    </div>

    <!-- Error Message -->
    <div class="mb-8 animate-slide-up">
      <h1 class="text-8xl font-bold mb-4 text-red-600 animate-pulse">{errorCode}</h1>
      <h2 class="text-3xl font-bold text-gray-800 mb-4">Error del servidor</h2>
      <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
        Ha ocurrido un error interno en el servidor. Nuestro equipo ha sido notificado y está trabajando para solucionarlo.
      </p>
    </div>

    <!-- Error Details (if available) -->
    {#if errorMessage && errorMessage !== 'Internal Error'}
      <div class="mb-6 p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 text-sm text-gray-700">
        <strong>Detalles:</strong> {errorMessage}
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="space-y-4 animate-slide-up" style="animation-delay: 0.2s;">
      <button 
        on:click={handleAction}
        class="block w-full px-8 py-4 bg-primary text-white rounded-xl shadow-lg hover:bg-[#27406a] hover:shadow-xl transform hover:scale-105 transition-all duration-300 font-semibold text-lg"
      >
        🔄 Reintentar
      </button>
      
      <button 
        on:click={goHome}
        class="block w-full px-8 py-4 bg-white text-gray-700 rounded-xl shadow-md hover:shadow-lg border-2 border-gray-200 hover:border-gray-300 transition-all duration-300 font-medium"
      >
        🏠 Volver al inicio
      </button>
    </div>

    <!-- Additional Help -->
    <div class="mt-8 p-6 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 animate-slide-up" style="animation-delay: 0.4s;">
      <div class="flex items-start space-x-3">
        <div class="text-2xl">💡</div>
        <div class="text-left">
          <p class="font-semibold text-gray-800 mb-2">Error temporal</p>
          <p class="text-sm text-gray-600 leading-relaxed">
            Si el problema persiste, por favor contacta al administrador del sistema o intenta más tarde.
          </p>
        </div>
      </div>
    </div>

    <!-- Status Check -->
    <div class="mt-6 animate-slide-up" style="animation-delay: 0.6s;">
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
          <span class="text-sm text-orange-700 font-medium">Estado del sistema: Verificando...</span>
        </div>
        <p class="text-xs text-orange-600 mt-2">
          Los servicios se están restaurando automáticamente
        </p>
      </div>
    </div>

    <!-- Technical Details (for debugging) -->
    <details class="mt-6 text-left animate-slide-up" style="animation-delay: 0.8s;">
      <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">Información técnica</summary>
      <div class="mt-3 p-4 bg-gray-900 rounded-lg text-xs font-mono text-green-400 overflow-x-auto">
        <div class="space-y-1">
          <p><span class="text-gray-500">Error:</span> {errorCode} - {errorMessage}</p>
          <p><span class="text-gray-500">Timestamp:</span> {new Date().toISOString()}</p>
          <p><span class="text-gray-500">URL:</span> {$page.url.pathname}</p>
          <p><span class="text-gray-500">User Agent:</span> {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) + '...' : 'N/A'}</p>
        </div>
      </div>
    </details>
  </div>

<style>
  .text-primary {
    color: #35528C;
  }
  .bg-primary {
    background-color: #35528C;
  }
  .bg-primary:hover {
    background-color: #27406a;
  }
  .text-red-600 {
    color: #DC2626;
  }
  .text-blue-600 {
    color: #2563EB;
  }
  .text-yellow-600 {
    color: #D97706;
  }
  
  @keyframes bounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }
  .animate-bounce {
    animation: bounce 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  .animate-pulse {
    animation: pulse 2s infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .animate-fade-in {
    animation: fadeIn 0.6s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-slide-up {
    animation: slideUp 0.6s ease-out;
    animation-fill-mode: both;
  }
</style>

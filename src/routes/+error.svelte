<script lang="ts">
  import { page } from '$app/stores';
  import { siteName } from '../lib/config';

  // SvelteKit pasa el error automáticamente via $page.error y $page.status
  $: errorCode = $page.status || 500;
  $: errorMessage = $page.error?.message || 'Ha ocurrido un error inesperado';
  
  // Determinar el tipo de error y mensaje personalizado
  $: ({ title, description, actionText, actionIcon, bgGradient, iconColor, textColor, accentColor, illustration } = getErrorDetails(errorCode));
  
  function getErrorDetails(code: number) {
    switch (code) {
      case 404:
        return {
          title: 'Página no encontrada',
          description: 'La página que buscas no existe o ha sido movida. Verifica la URL o navega desde el menú principal.',
          actionText: 'Ir al inicio',
          actionIcon: '🏠',
          bgGradient: 'from-white to-gray-50',
          iconColor: 'text-[#2A4169]',
          textColor: 'text-[#2A4169]',
          accentColor: 'border-blue-200 bg-blue-100',
          illustration: 'search'
        };
      case 500:
        return {
          title: 'Error del servidor',
          description: 'Ha ocurrido un error interno. Nuestro equipo ha sido notificado y está trabajando en la solución.',
          actionText: 'Reintentar',
          actionIcon: '🔄',
          bgGradient: 'from-white to-red-50',
          iconColor: 'text-red-500',
          textColor: 'text-[#2A4169]',
          accentColor: 'border-red-200 bg-red-100',
          illustration: 'server'
        };
      case 403:
        return {
          title: 'Acceso denegado',
          description: 'No tienes permisos para acceder a esta página. Contacta al administrador si crees que es un error.',
          actionText: 'Volver',
          actionIcon: '←',
          bgGradient: 'from-white to-yellow-50',
          iconColor: 'text-yellow-500',
          textColor: 'text-[#2A4169]',
          accentColor: 'border-yellow-200 bg-yellow-100',
          illustration: 'lock'
        };
      default:
        return {
          title: 'Error inesperado',
          description: 'Ha ocurrido un error. Por favor, inténtalo más tarde o contacta al soporte.',
          actionText: 'Ir al inicio',
          actionIcon: '🏠',
          bgGradient: 'from-white to-gray-50',
          iconColor: 'text-gray-500',
          textColor: 'text-[#2A4169]',
          accentColor: 'border-gray-200 bg-gray-100',
          illustration: 'warning'
        };
    }
  }

  function handleAction() {
    if (typeof window === 'undefined') return;
    if (errorCode === 500 || errorCode === 403) {
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

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br {bgGradient} p-4">
  <div class="max-w-2xl w-full">
    <!-- Main Error Card -->
    <div class="bg-white overflow-hidden animate-fade-in">
      
      <!-- Header with Illustration -->
      <div class="relative px-8 pt-12 pb-8 text-center">
        <div class="absolute inset-0 bg-gradient-to-b from-transparent to-white/10"></div>
        
        <!-- SVG Illustration based on error type -->
        <div class="relative z-10 mb-6">
          {#if illustration === 'search'}
            <svg class="w-24 h-24 mx-auto text-[#2A4169] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 13l6 6"></path>
            </svg>
          {:else if illustration === 'server'}
            <svg class="w-24 h-24 mx-auto {iconColor} animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path>
            </svg>
          {:else if illustration === 'lock'}
            <svg class="w-24 h-24 mx-auto {iconColor} animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke-width="1.5"></rect>
              <circle cx="12" cy="16" r="1" stroke-width="1.5"></circle>
              <path d="m9 11 3-3 3 3" stroke-width="1.5"></path>
            </svg>
          {:else}
            <svg class="w-24 h-24 mx-auto {iconColor} animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          {/if}
        </div>
        
        <!-- Error Code -->
        <div class="text-9xl font-black {textColor} mb-4 animate-slide-up opacity-20 select-none">
          {errorCode}
        </div>
        
        <!-- Title and Description -->
        <h1 class="text-4xl font-bold {textColor} mb-4 animate-slide-up" style="animation-delay: 0.1s;">
          {title}
        </h1>
        <p class="text-lg text-gray-600 max-w-lg mx-auto leading-relaxed animate-slide-up" style="animation-delay: 0.2s;">
          {description}
        </p>
      </div>

      <!-- Action Buttons -->
      <div class="px-8 pb-8">
        <div class="flex space-x-3 animate-slide-up" style="animation-delay: 0.3s;">
          <button 
            on:click={goBack}
            class="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all duration-300 flex items-center justify-center space-x-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            <span>Volver</span>
          </button>
          
          <button 
            on:click={goHome}
            class="flex-1 py-3 px-4 bg-[#35528C] hover:bg-[#2a4068] text-white font-medium rounded-xl transition-all duration-300 flex items-center justify-center space-x-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            <span>Inicio</span>
          </button>
        </div>
      </div>

      <!-- Help Section -->
      <div class="px-8 pb-8 animate-slide-up" style="animation-delay: 0.4s;">
        <div class="p-6 {accentColor} rounded-2xl">
          <div class="flex items-start space-x-3">
            <div class="text-2xl">💡</div>
            <div>
              <p class="font-semibold text-gray-800 mb-2">¿Necesitas ayuda?</p>
              <p class="text-sm text-gray-600 leading-relaxed">
                {#if errorCode === 404}
                  Verifica que la URL esté escrita correctamente o usa los enlaces de navegación.
                {:else if errorCode === 500}
                  Si el problema persiste, contacta al administrador del sistema.
                {:else if errorCode === 403}
                  Solicita acceso al administrador si necesitas esta página.
                {:else}
                  Contacta al soporte técnico para asistencia adicional.
                {/if}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Technical Details for Developers -->
      {#if errorCode >= 500}
        <details class="px-8 pb-8 animate-slide-up" style="animation-delay: 0.5s;">
          <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
            <span>Detalles técnicos</span>
          </summary>
          <div class="mt-4 p-4 bg-gray-900 rounded-xl text-xs font-mono text-green-400 overflow-x-auto">
            <div class="space-y-2">
              <div><span class="text-gray-500">Código:</span> {errorCode}</div>
              <div><span class="text-gray-500">Mensaje:</span> {errorMessage}</div>
              <div><span class="text-gray-500">URL:</span> {$page.url.pathname}</div>
              <div><span class="text-gray-500">Timestamp:</span> {new Date().toISOString()}</div>
              {#if typeof navigator !== 'undefined'}
                <div><span class="text-gray-500">Navegador:</span> {navigator.userAgent.split(' ').pop()}</div>
              {/if}
            </div>
          </div>
        </details>
      {/if}
    </div>
  </div>
</div>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .animate-fade-in {
    animation: fadeIn 0.8s ease-out;
    animation-fill-mode: both;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
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

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .text-9xl {
      font-size: 6rem;
    }
    .text-4xl {
      font-size: 2rem;
    }
  }
</style>

<script>
  import { onMount } from 'svelte';
  import lottie from 'lottie-web';

  let container;

  onMount(() => {
    // Intentar cargar la animación desde diferentes fuentes
    const loadAnimation = async () => {
      try {
        const animation = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'https://assets10.lottiefiles.com/packages/lf20_RYmOqgArze.json' // Nueva animación de dinero más profesional
        });

        animation.setSpeed(0.8); // Hacer la animación un poco más lenta

        return () => animation.destroy();
      } catch (error) {
        console.error('Error loading animation:', error);
        // Fallback a una animación estática si falla la carga
        container.innerHTML = '<div class="fallback">💰</div>';
      }
    };

    return loadAnimation();
  });
</script>

<div class="animation-container">
  <div 
    bind:this={container}
    class="lottie-container"
  ></div>
</div>

<style>
  .animation-container {
    width: 140px;
    height: 140px;
    margin: 0 auto 1rem auto;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .lottie-container {
    width: 100%;
    height: 100%;
    transform-origin: center center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    filter: drop-shadow(0 4px 12px rgba(53, 82, 140, 0.15));
  }

  .lottie-container:hover {
    transform: scale(1.05) translateY(-2px);
    filter: drop-shadow(0 8px 16px rgba(53, 82, 140, 0.2));
  }

  .fallback {
    font-size: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
</style>

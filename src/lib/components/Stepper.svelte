<script lang="ts">
  export let currentStep: number;
  
  const steps = [
    { number: 1, label: 'Usuario' },
    { number: 2, label: 'Cantidad' },
    { number: 3, label: 'Detalles' },
    { number: 4, label: 'Confirmar' }
  ];

  $: stepStyles = steps.map(step => {
    if (step.number < currentStep) return 'completed';
    if (step.number === currentStep) return 'active';
    return 'pending';
  });

  $: function getStepStyle(stepNumber: number): string {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'active';
    return 'pending';
  }
</script>

<div class="w-full max-w-4xl mx-auto px-4">
  <div class="flex items-center justify-between">
    {#each steps as step, index}
      <div class="flex flex-col items-center flex-1">
        <!-- Círculo con número -->
        <div class={`
          w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
          ${getStepStyle(step.number) === 'completed' ? 'bg-primary-700 text-white shadow-lg shadow-primary-700/20' : ''}
          ${getStepStyle(step.number) === 'active' ? 'bg-white border-2 border-primary-700 text-primary-700' : ''}
          ${getStepStyle(step.number) === 'pending' ? 'bg-gray-100 text-gray-400 border border-gray-200' : ''}
        `}>
          <span class="text-lg font-bold">{step.number}</span>
        </div>
        
        <!-- Etiqueta -->
        <span class={`
          text-xs tracking-wide uppercase mt-2.5 transition-colors duration-200
          ${getStepStyle(step.number) === 'completed' ? 'text-primary-700 font-semibold' : ''}
          ${getStepStyle(step.number) === 'active' ? 'text-primary-700 font-bold' : ''}
          ${getStepStyle(step.number) === 'pending' ? 'text-gray-400 font-medium' : ''}
        `}>
          {step.label}
        </span>

        <!-- Línea conectora -->
        {#if index < steps.length - 1}
          <div class={`
            absolute w-full h-0.5 top-5 -z-10 left-0
            ${currentStep > step.number ? 'bg-primary-700' : 'bg-gray-200'}
          `} style="width: calc(100% - 2.5rem); left: calc(50% + 1.25rem);">
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  /* Estilos adicionales si son necesarios */
</style>

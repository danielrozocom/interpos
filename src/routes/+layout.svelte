<script lang="ts">
  import '../app.css';
</script>

<div class="min-h-screen bg-gray-50">
  <nav class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <h1 class="text-xl font-bold text-gray-900">InterPOS</h1>
        </div>
        <div class="flex items-center space-x-4">
          <a href="/" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Inicio</a>
          <a href="/recharge" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Recargar</a>
          <a href="/history" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Historial</a>
          <a href="/check-balance" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Consultar Saldo</a>
        </div>
      </div>
    </div>
  </nav>
  
  <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <slot />
  </main>
</div>

<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';
  let error: string | null = null;

  async function signInWithGoogle() {
    try {
      // Prefer supabase client OAuth flow
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/auth/callback' } });
    } catch (e) {
      // Fallback: client-side redirect to the app's signin route
      try { window.location.href = '/auth/signin/google'; } catch (_) { /* ignore */ }
    }
  }
</script>

<div class="max-w-md mx-auto mt-24 p-6 bg-white rounded shadow">
  <h2 class="text-xl font-bold mb-4">Iniciar sesión</h2>
  {#if error}
    <div class="mb-4 text-red-600">{error}</div>
  {/if}
  <div class="flex flex-col gap-3">
    <button on:click={signInWithGoogle} class="px-4 py-2 bg-red-600 text-white rounded">Iniciar con Google</button>
    <div class="text-sm text-gray-600">Usa tu cuenta de Google registrada en la hoja "Users - System"</div>
  </div>
</div>

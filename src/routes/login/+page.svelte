<script lang="ts">
  import { onMount } from 'svelte';
  let showLogin = true;
  let loading = false;
  import { supabase } from '$lib/supabaseClient';

  onMount(() => {
    // We rely on the server-side /auth/callback to process the OAuth redirect
    // and set the HttpOnly session cookie for SSR. Keep a lightweight debug
    // log so developers can confirm the page mounted.
    console.debug('login page mounted', { href: window.location.href, hash: window.location.hash });
  });

  async function loginWithGoogle() {
    try {
      loading = true;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          // Use implicit flow which sends tokens in fragment
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (error) {
        console.error('Error starting OAuth:', error);
        alert('Error al iniciar sesión: ' + error.message);
        loading = false;
        return;
      }
      
      const maybeUrl = (data as any)?.url ?? null;
      if (maybeUrl) {
        // Navigate to provider URL
        console.log('Redirecting to Google OAuth...');
        window.location.href = maybeUrl;
        return;
      }
      // If SDK doesn't return a URL, keep loading and wait for auth change via listener
    } catch (err) {
      console.error('Unexpected login error', err);
      alert('Error inesperado al iniciar sesión');
      loading = false;
    }
  }
</script>

<style>
  /* Use the same soft app background as main content for a uniform look */
  .login-page { display:flex; min-height:100vh; align-items:center; justify-content:center; background:#f8fafc; }
  .card { background:white; padding:2.5rem 2rem; border-radius:16px; box-shadow:0 8px 32px rgba(2,6,23,0.10); width:400px; max-width:95%; }
  .card h1 { font-size:2rem; font-weight:700; margin-bottom:0.25rem; }
  .card p { margin-bottom:1.5rem; }
  /* Brand button: use InterPOS primary color */
  .login-btn { width:100%; padding:0.75rem 0; background:#35528C; color:#fff; font-weight:600; border:none; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:0.75rem; font-size:1rem; box-shadow:0 2px 8px rgba(53,82,140,0.10); transition:background 0.18s, transform 0.08s; cursor:pointer; }
  .login-btn:hover { background:#2d4570; transform: translateY(-1px); }
  .login-btn[disabled] { opacity:0.85; cursor:wait; transform:none; }
  .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius:50%; display:inline-block; animation:spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

<div class="login-page">
  <div class="card">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      <img src="/favicon.svg" alt="Interpos" width="44" height="44" style="border-radius:8px;" />
      <div>
        <h1 class="text-2xl font-bold">Interpos — Login</h1>
        <p class="text-sm text-gray-600">Entra con tu cuenta de Google</p>
      </div>
    </div>

    <button on:click={loginWithGoogle} class="login-btn mb-3" disabled={loading} aria-busy={loading}>
      {#if loading}
        <span class="spinner" aria-hidden="true"></span>
        <span>Redirigiendo…</span>
      {:else}
        <!-- white google mark for contrast on brand button -->
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg">
          <path fill="#FFFFFF" d="M12 11.5v1.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l1.4-1.3C16.6 4.1 14.5 3 12 3 7.6 3 4 6.6 4 11s3.6 8 8 8c4.6 0 7.6-3.2 7.6-7.8 0-.5 0-.9-.1-1.2H12z"/>
        </svg>
        <span>Iniciar sesión con Google</span>
      {/if}
    </button>

    <p class="text-xs text-gray-500 mt-4">Si necesitas ayuda contacta al administrador.</p>
  </div>
</div>

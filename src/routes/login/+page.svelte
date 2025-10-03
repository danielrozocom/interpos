<script lang="ts">
  import { onMount } from 'svelte';
  import { siteName } from '$lib/config';
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

<svelte:head>
  <title>Login | {siteName}</title>
</svelte:head>

<style>
  /* Page background and centered card */
  /* reset body so no unexpected scroll margin */
  :global(html), :global(body) { height:100%; margin:0; }
  /* prevent the browser page from scrolling for this route; allow internal scrolling inside the card */
  :global(body) { overflow:hidden; }
  /* Use min-height so the page can be centered inside layouts that reserve a topbar height
    and to avoid forcing full-viewport height when the topbar is present. Keep flex centering. */
  .login-page { display:flex; min-height:calc(100vh - var(--topbar-h, 64px)); align-items:center; justify-content:center; overflow:auto; padding:1.5rem 0; }
  .card { background:linear-gradient(180deg,#ffffff,#fbfdff); padding:0; border-radius:16px; border:1px solid rgba(2,6,23,0.03); /* lighter border */
    /* softer, vertically-focused shadow */
    box-shadow:0 12px 28px rgba(2,6,23,0.045); width:420px; max-width:95%; overflow:hidden; max-height:calc(100vh - var(--topbar-h,64px) - 48px); position:relative; margin:0 auto; }
  .brand { background:#35528C; color:#fff; padding:0.9rem 1rem; text-align:center; }
  .brand h1 { font-size:2rem; font-weight:800; margin:0; letter-spacing:0.6px; }
  .card-body { padding:1.25rem 1.5rem; overflow:auto; max-height:calc(100vh - 160px); }
  /* Use a responsive size so 'Login' stays legible on small screens while remaining balanced on desktop */
  .card h2 { font-size:clamp(2rem, 4.5vw, 2rem); font-weight:800; margin:0.5rem 0 1rem 0; text-align:center; color:#374151; }
  .card p { margin-bottom:1.5rem; text-align:center; }
  /* Logo: top logo inside the card under the brand */
  .top-logo { display:block; margin:0.5rem auto 1.6rem auto; width:120px; height:auto; max-height:120px; border-radius:10px; background:transparent; padding:0; box-shadow:none; }

  /* Responsive: shrink logo on small screens so card doesn't overflow */
  @media (max-height:700px), (max-width:420px) {
    .card { max-height:92vh; margin:0 12px; width:calc(100% - 24px); border-radius:12px; }
    .card-body { padding:1rem; }
  .top-logo { width:100px; max-height:100px; margin-bottom:1.2rem; }
  /* Keep other responsive adjustments but don't force the heading smaller than our clamp allows */
  }
  /* Button: brand blue with white text/icon */
  .login-btn { width:100%; padding:0.65rem 0.6rem; background:#35528C; color:#ffffff; font-weight:700; border:none; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:0.6rem; font-size:0.98rem; box-shadow:0 3px 12px rgba(53,82,140,0.12); transition:background 0.12s, transform 0.08s, box-shadow 0.12s; cursor:pointer; }
  .login-btn:hover { background:#2b426b; transform: translateY(-1px); box-shadow:0 6px 22px rgba(53,82,140,0.18); }
  .login-btn:focus { outline:3px solid rgba(53,82,140,0.16); outline-offset:3px; }
  .login-btn[disabled] { opacity:0.85; cursor:wait; transform:none; }
  .login-btn .g-mark { width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#ffffff; box-shadow:0 1px 3px rgba(2,6,23,0.08); }
  .spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.35); border-top-color: rgba(255,255,255,0.9); border-radius:50%; display:inline-block; animation:spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .help-text { text-align:center; color:#374151; font-size:0.95rem; font-weight:600; }
</style>

<div class="login-page">
  <div class="card">
      <!-- Vertical layout per request: Title (blue banner), Login label, logo, Google button, help text -->
      <div class="brand">
        <h1>InterPOS</h1>
      </div>
      <div class="card-body">
  <h2>Login</h2>
  <img src="/favicon.svg" alt="Interpos logo" class="top-logo" />

        <button on:click={loginWithGoogle} class="login-btn mb-3" disabled={loading} aria-busy={loading} aria-label="Iniciar sesión con Google">
      {#if loading}
        <span class="spinner" aria-hidden="true"></span>
        <span>Redirigiendo…</span>
      {:else}
        <!-- Official Google 'G' mark inside white circle -->
        <span class="g-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.23-.17-1.81H9v3.42h4.84c-.21 1.16-.84 2.15-1.8 2.82v2.34h2.91c1.7-1.57 2.69-3.86 2.69-6.77z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.91-2.34c-.8.54-1.82.86-3.05.86-2.35 0-4.34-1.58-5.05-3.72H1.02v2.33C2.5 15.78 5.53 18 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.63A5.41 5.41 0 0 1 3.6 9c0-.64.11-1.26.31-1.83V4.84H1.02A9 9 0 0 0 0 9c0 1.45.35 2.82.97 4.01l2.98-2.38z"/>
            <path fill="#EA4335" d="M9 3.56c1.32 0 2.5.45 3.43 1.34l2.57-2.57C13.44.99 11.4 0 9 0 5.53 0 2.5 2.22 1.02 4.84l2.98 2.33C4.66 5.14 6.65 3.56 9 3.56z"/>
          </svg>
        </span>
        <span>Iniciar sesión con Google</span>
      {/if}
    </button>
  <p class="help-text mt-4">Si necesitas ayuda contacta al administrador.</p>
    </div>
  </div>
</div>

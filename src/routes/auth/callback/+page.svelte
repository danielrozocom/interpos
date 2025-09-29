<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    // Supabase will redirect with access_token in URL hash or search params depending on flow
    const url = new URL(window.location.href);
    const hash = url.hash.replace('#', '');
    const params = new URLSearchParams(hash || url.search);
    const access_token = params.get('access_token') || params.get('accessToken') || null;
    if (access_token) {
      // POST to server to set httpOnly cookie
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token })
      });
      // redirect to home
      window.location.href = '/';
    } else {
      // no token present, redirect to signin
      window.location.href = '/auth/signin';
    }
  });
</script>

<div class="p-4">Procesando inicio de sesión...</div>

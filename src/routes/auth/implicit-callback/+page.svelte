<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { invalidateAll } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';

  onMount(async () => {
    // Handle implicit OAuth flow
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      try {
        // Parse tokens from the hash (format: #access_token=...&refresh_token=...)
        const params = new URLSearchParams(hash.slice(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (!access_token || !refresh_token) {
          console.error('Missing tokens in implicit flow hash');
          goto('/login?error=implicit_auth_failed');
          return;
        }

        // Send tokens to server to set HttpOnly cookies
        const res = await fetch('/auth/implicit-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, refresh_token })
        });

        if (!res.ok) {
          console.error('Server failed to set cookies for implicit flow');
          goto('/login?error=implicit_cookie_failed');
          return;
        }

        console.log('✓ Implicit OAuth successful, server stored cookies');
        // Invalidate all data to force refresh of user state
        await invalidateAll();
        // Clear the hash from the URL and redirect to home
        goto('/', { replaceState: true });
      } catch (err) {
        console.error('Unexpected error in implicit callback:', err);
        goto('/login?error=implicit_error');
      }
    } else {
      // No hash or invalid hash, redirect to login
      goto('/login?error=invalid_callback');
    }
  });
</script>

<div class="min-h-screen flex items-center justify-center" aria-hidden="true">
  <div class="text-center">
    <!-- Spinner removed as requested -->
  </div>
</div>
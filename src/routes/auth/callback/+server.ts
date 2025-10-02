import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const GET: RequestHandler = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const next = url.searchParams.get('next') ?? '/';

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    throw redirect(303, `/login?error=${encodeURIComponent(error)}`);
  }

  if (code) {
    // PKCE flow: exchange code for session
    try {
      console.log('✓ Received OAuth code, exchanging for session...');
      
      // Exchange the code for a session using the server admin client
      const { data, error } = await sbServer.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('Error exchanging code for session:', error);
        throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
      }

      if (data?.session) {
        // Set the session cookies manually for SSR
        const { access_token, refresh_token } = data.session;
        
        // Set cookies with proper options for production
        cookies.set('sb-access-token', access_token, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        cookies.set('sb-refresh-token', refresh_token, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        console.log('✓ OAuth callback successful, session created for user:', data.user?.email);
        
        // Redirect to home or the requested next URL
        throw redirect(303, next);
      }
    } catch (err) {
      // If it's already a redirect, re-throw it
      if (err && typeof err === 'object' && 'status' in err && (err as any).status === 303) {
        throw err;
      }
      console.error('Unexpected error in auth callback:', err);
      throw redirect(303, '/login?error=auth_failed');
    }
  } else {
    // Implicit flow: tokens are in URL fragment, redirect to client-side handling
    console.log('✓ OAuth callback - implicit flow, redirecting to client-side handling');
    // For implicit flow, we need to redirect to a page that can handle the hash
    throw redirect(303, `/auth/implicit-callback?next=${encodeURIComponent(next)}`);
  }

  // If we get here, something went wrong
  throw redirect(303, '/login?error=invalid_callback');
};
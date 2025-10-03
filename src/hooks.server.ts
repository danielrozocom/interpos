import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Centralized error handler for server-side errors
export const handleError = async ({ error, event }: { error: unknown; event: any }) => {
  console.error('Error occurred:', error, 'on', event?.url?.pathname);

  return {
    message: (error as any)?.message || 'Ha ocurrido un error inesperado'
  };
};

// Simplified handle without handleAuth dependency
const _composedHandle = sequence(

  // after the auth handler runs, attempt to populate event.locals.user by calling
  // any getSession helper the auth middleware may have installed. Use `any` casts
  // to avoid strict Locals typing issues in this repo.
  async ({ event, resolve }) => {
    // Read and validate session from cookies
    try {
      const accessToken = event.cookies.get('sb-access-token');
      console.log('[DEBUG] Found access token:', !!accessToken);
      
      if (accessToken) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
          process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        console.log('[DEBUG] getUser result:', { hasUser: !!user, error: error?.message });

        if (!error && user) {
          (event.locals as any).user = user;
          console.log('[DEBUG] User authenticated:', user.email);
        } else {
          console.log('[DEBUG] Access token invalid, clearing session');
          (event.locals as any).user = null;
          event.cookies.delete('sb-access-token', { path: '/' });
          event.cookies.delete('sb-refresh-token', { path: '/' });
        }
      } else {
        (event.locals as any).user = null;
      }
    } catch (err) {
      console.error('Error validating session in hooks:', err);
      (event.locals as any).user = null;
    }

    // If the user is not authenticated, redirect to /login for most routes.
    // Allow certain public routes: static assets, /api/*, /auth/*, and /check-balance
    const publicPaths = [
      '/check-balance',
      '/auth',
      '/api',
      '/_app',
      '/favicon',
      '/robots.txt',
      '/sitemap.xml'
    ];

    const isPublic = publicPaths.some(p => event.url.pathname === p || event.url.pathname.startsWith(p + '/') || event.url.pathname.startsWith(p + '.'));

    if (!(event.locals as any).user && !isPublic) {
      // If the request is for the login page already, or for static files, allow it.
      if (event.url.pathname !== '/login') {
        return new Response(null, {
          status: 303,
          headers: { Location: '/login' }
        });
      }
    }

    return await resolve(event);
  }
);

export const handle: Handle = async (input) => {
  try {
    return await _composedHandle(input as any);
  } catch (err) {
    console.error('UNHANDLED ERROR in handle:', err && (err as any).stack ? (err as any).stack : err);
    throw err;
  }
};

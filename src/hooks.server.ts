import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
// Import handleAuth lazily to avoid initialization errors when env vars are missing.
let handleAuth: any = null;
try {
  // require at runtime so we can guard on env vars
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  handleAuth = require('@supabase/auth-helpers-sveltekit').handleAuth;
} catch (e) {
  // module may be missing in some environments; we'll handle that gracefully below
  handleAuth = null;
}

// Centralized error handler for server-side errors
export const handleError = async ({ error, event }: { error: unknown; event: any }) => {
  console.error('Error occurred:', error, 'on', event?.url?.pathname);

  return {
    message: (error as any)?.message || 'Ha ocurrido un error inesperado'
  };
};

// Use the auth helper to handle the auth routes (callback, logout, etc.)
// and then populate event.locals with a lightweight getSession helper and user
// so rest of the app can read the session in server load functions.
const _composedHandle = sequence(
  // auth handler - mounts routes like /auth/callback used by Supabase
  // Only use the handler if we successfully imported it and the expected
  // environment variables are present. If not, use a noop handler so requests
  // don't fail with initialization errors.
  (function () {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_UR || '';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    // Log every request to /auth/callback for debugging
    return async function handleWithLogging({ event, resolve }: any) {
      if (event.url.pathname.startsWith('/auth/callback')) {
        console.log('[DEBUG] /auth/callback hit:', event.url.pathname, 'method:', event.request.method);
      }
      if (handleAuth && SUPABASE_URL && SUPABASE_KEY) {
        try {
          // Log before running handleAuth
          if (event.url.pathname.startsWith('/auth/callback')) {
            console.log('[DEBUG] Running handleAuth for /auth/callback');
          }
          return await handleAuth()(event, resolve);
        } catch (e) {
          console.warn('handleAuth initialization failed, continuing without it', e);
          return await resolve(event);
        }
      }
      if (!handleAuth) console.warn('handleAuth not available; skipping Supabase auth middleware');
      else console.warn('Supabase env vars missing; skipping Supabase auth middleware');
      return await resolve(event);
    }
  })(),

  // after the auth handler runs, attempt to populate event.locals.user by calling
  // any getSession helper the auth middleware may have installed. Use `any` casts
  // to avoid strict Locals typing issues in this repo.
  async ({ event, resolve }) => {
    // Instead of relying on getSession from auth-helpers (deprecated),
    // read the session from cookies that our /auth/callback endpoint sets
    try {
      const accessToken = event.cookies.get('sb-access-token');
      const refreshToken = event.cookies.get('sb-refresh-token');
      
      if (accessToken && refreshToken) {
        // Verify the session using the access token
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
          process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
        );
        
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        
        if (!error && user) {
          (event.locals as any).user = user;
        } else {
          (event.locals as any).user = null;
          // Clear invalid cookies
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

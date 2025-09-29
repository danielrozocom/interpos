import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
// Note: the older `@supabase/auth-helpers-sveltekit` package used to export
// `handleAuth`. That package/version may be deprecated and its API can differ.
// To keep the dev server running without pulling in a specific auth helper,
// use a small no-op auth handle here. The `populateUserHandle` below still
// populates `event.locals.user` from session/cookies when present.
import { sbServer } from '$lib/supabase';

// noop auth handle (keeps compatibility until migrated to @supabase/ssr)
const authHandle = async ({ event, resolve }: { event: any; resolve: any }) => {
  // auth helpers normally attach session/supabase to event.locals; we keep
  // this noop so subsequent handlers run regardless of auth helper presence.
  return await resolve(event);
};

export const handleError = async ({ error, event }: { error: unknown; event: any }) => {
  console.error('Error occurred:', error, 'on', event?.url?.pathname);

  return {
    message: (error as any)?.message || 'Ha ocurrido un error inesperado'
  };
};

// After the authentication handle runs, populate event.locals.user from the session
async function populateUserHandle({ event, resolve }: { event: any; resolve: any }) {
  try {
    // auth-helpers sets event.locals.session and event.locals.supabase
    let session = (event.locals as any).session || null;
    // fallback: read sb_access_token cookie and validate
    if (!session) {
      const cookie = event.request.headers.get('cookie') || '';
      const match = cookie.match(/sb_access_token=([^;]+)/);
      const token = match ? match[1] : null;
      if (token) {
        try {
          const { data } = await sbServer.auth.getUser(token);
          if (data?.user) {
            session = { user: { email: data.user.email, name: data.user.user_metadata?.full_name || data.user.email } };
          }
        } catch (e) {
          // ignore
        }
      }
    }
    if (session?.user) {
      const email = session.user.email?.toLowerCase();
      // lookup role in users table
      try {
        const { data, error } = await sbServer.from('users').select('name,role').eq('email', email).limit(1).maybeSingle();
        if (!error && data) {
          event.locals.user = { email, name: data.name || session.user.name || '', role: data.role || '' };
        } else {
          event.locals.user = { email, name: session.user.name || '', role: '' };
        }
      } catch (e) {
        event.locals.user = { email, name: session.user.name || '', role: '' };
      }
    } else {
      event.locals.user = null;
    }
  } catch (e) {
    event.locals.user = null;
  }
  return await resolve(event);
}

export const handle: Handle = sequence(authHandle as any, populateUserHandle as any);

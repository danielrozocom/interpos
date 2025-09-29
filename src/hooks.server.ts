import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
// Note: the older `@supabase/auth-helpers-sveltekit` package used to export
// `handleAuth`. That package/version may be deprecated and its API can differ.
// To keep the dev server running without pulling in a specific auth helper,
// use a small no-op auth handle here. The `populateUserHandle` below still
// populates `event.locals.user` from session/cookies when present.
import { sbServer } from '$lib/supabase';

// noop auth handle (keeps compatibility until migrated to @supabase/ssr)

export const handleError = async ({ error, event }: { error: unknown; event: any }) => {
  console.error('Error occurred:', error, 'on', event?.url?.pathname);

  return {
    message: (error as any)?.message || 'Ha ocurrido un error inesperado'
  };
};

// After the authentication handle runs, populate event.locals.user from the session

export const handle: Handle = sequence(async ({ event, resolve }: { event: any; resolve: any }) => {
  return await resolve(event);
}, async ({ event, resolve }: { event: any; resolve: any }) => {
  return await resolve(event);
});

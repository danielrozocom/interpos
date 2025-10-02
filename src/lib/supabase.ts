import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL as SK_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY as SK_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Prefer SvelteKit static private env, but fall back to process.env.
// If env vars are missing in development, attempt to load `.env` via dotenv so
// local runs pick them up automatically.
let SUPABASE_URL = SK_SUPABASE_URL || process.env.SUPABASE_URL || '';
let SUPABASE_SERVICE_ROLE_KEY = SK_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if ((!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) && process.env.NODE_ENV !== 'production') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv');
    dotenv.config();
    // re-read
    SUPABASE_URL = SUPABASE_URL || process.env.SUPABASE_URL || '';
    SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    console.debug('[supabase] dotenv loaded for development');
  } catch (err) {
    // ignore if dotenv missing
  }
}

// Safe debug: print presence/masked values so developer can confirm env vars are visible.
const mask = (s: string | undefined | null) => {
  if (!s) return null;
  if (s.length <= 8) return '********';
  return s.slice(0, 4) + '...' + s.slice(-4);
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set or empty');
  console.debug('[supabase] env SUPABASE_URL present:', !!SUPABASE_URL, 'masked:', mask(SUPABASE_URL));
  console.debug('[supabase] env SUPABASE_SERVICE_ROLE_KEY present:', !!SUPABASE_SERVICE_ROLE_KEY, 'masked:', mask(SUPABASE_SERVICE_ROLE_KEY));
} else {
  console.debug('[supabase] SUPABASE env present; SUPABASE_URL masked:', mask(SUPABASE_URL));
}

// Create the Supabase client lazily. This avoids calling createClient() at module
// initialization time (which can fail during SSR if env vars aren't available yet).
// On first access, we validate env vars and construct the client; otherwise we
// throw a clear error explaining what env is missing.
import type { SupabaseClient } from '@supabase/supabase-js';

let _sbClient: SupabaseClient | null = null;
function getSbClient(): SupabaseClient {
  if (_sbClient) return _sbClient;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase server client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in the environment.');
  }
  _sbClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'x-application-name': 'interpos' } }
  });
  return _sbClient;
}

// Export a Proxy that forwards operations to the real client when first used.
// This keeps the same `sbServer` import shape used across the codebase.
export const sbServer: any = new Proxy({}, {
  get(_target, prop: string | symbol) {
    const client = getSbClient();
    // @ts-ignore: forward to underlying client
    const value = (client as any)[prop];
    if (typeof value === 'function') return value.bind(client);
    return value;
  },
  // handle calling the proxy as a function, though the Supabase client isn't a
  // function in practice. This keeps the proxy robust.
  apply(_target, thisArg, args) {
    const client = getSbClient();
    return (client as any).apply(thisArg, args);
  }
});

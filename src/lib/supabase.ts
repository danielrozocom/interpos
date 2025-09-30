import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL as SK_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY as SK_SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Prefer SvelteKit static private env, but fall back to process.env (useful in local dev with dotenv)
const SUPABASE_URL = SK_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_UR || '';
const SUPABASE_SERVICE_ROLE_KEY = SK_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
}

export const sbServer = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'interpos' } }
});

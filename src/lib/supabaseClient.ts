import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Create the browser Supabase client lazily to avoid SSR issues when env vars are missing
let _supabaseClient: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;
  if (!url || !anon) {
    throw new Error('Browser Supabase client requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set in the environment.');
  }
  _supabaseClient = createClient(url, anon, {
    auth: {
      // Temporarily use implicit flow to test basic OAuth setup
      flowType: 'implicit',
      // We need to detect the session in URL for the OAuth callback to work properly
      detectSessionInUrl: true,
      // Don't persist session in localStorage - we use HttpOnly cookies from server
      persistSession: false,
      autoRefreshToken: false
    }
  });
  return _supabaseClient;
}

// Export a Proxy that forwards operations to the real client when first used
export const supabase: any = new Proxy({}, {
  get(_target, prop: string | symbol) {
    const client = getSupabaseClient();
    // @ts-ignore: forward to underlying client
    const value = (client as any)[prop];
    if (typeof value === 'function') return value.bind(client);
    return value;
  },
  apply(_target, thisArg, args) {
    const client = getSupabaseClient();
    return (client as any).apply(thisArg, args);
  }
});

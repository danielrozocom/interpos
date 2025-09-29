import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return new Response(JSON.stringify({
    hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.SUPABASE_UR,
    hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAuthSecret: !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
    nextauth_url: process.env.NEXTAUTH_URL || null
  }), { headers: { 'Content-Type': 'application/json' } });
};

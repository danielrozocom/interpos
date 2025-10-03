import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const accessToken = cookies.get('sb-access-token');
    console.log('[API] /auth/me called, has token:', !!accessToken);
    
    if (!accessToken) {
      console.log('[API] No access token found in cookies');
      return new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    );

    const { data, error } = await supabase.auth.getUser(accessToken);
    console.log('[API] getUser result:', { hasUser: !!data?.user, error: error?.message });
    
    if (error || !data?.user) {
      console.log('[API] Token validation failed, returning null user');
      return new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    console.log('[API] Returning authenticated user:', data.user.email);
    return new Response(JSON.stringify({ user: data.user }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error in /api/auth/me:', err);
    return new Response(JSON.stringify({ user: null }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

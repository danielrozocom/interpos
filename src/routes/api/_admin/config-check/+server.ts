import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  const config = {
    supabaseUrl: !!process.env.SUPABASE_URL,
    supabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    googleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    // También verificar las variables del navegador
    viteSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    viteSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY
  };

  return new Response(JSON.stringify({
    message: 'Environment variables check',
    config,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
import { json } from '@sveltejs/kit';

export function GET() {
  try {
    const env = process.env;
    const hasUrl = Boolean(env.SUPABASE_URL || env.SUPABASE_UR || env.VITE_SUPABASE_URL);
    const hasAnon = Boolean(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY);
    const hasService = Boolean(env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

    return json({ ok: true, hasSupabaseUrl: hasUrl, hasSupabaseAnonKey: hasAnon, hasSupabaseServiceKey: hasService, nodeEnv: env.NODE_ENV || null });
  } catch (err: any) {
    return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

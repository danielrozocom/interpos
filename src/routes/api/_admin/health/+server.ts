import { json } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export async function GET() {
  try {
    // Try a lightweight query against roles (should exist in DB after migration)
    const { data, error } = await sbServer.from('roles').select('id').limit(1);
    if (error) return json({ ok: false, error: error.message }, { status: 500 });
    return json({ ok: true, sample: (data && data[0]) || null });
  } catch (err: any) {
    return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

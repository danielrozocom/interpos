import { json } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { requireAdmin } from '$lib/admin';

export async function GET() {
  const { data, error } = await sbServer.from('allowed_emails').select('*').order('email', { ascending: true });
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ emails: data || [] });
}

export async function POST(event: any) {
  if (!(await requireAdmin(event))) return json({ error: 'Forbidden' }, { status: 403 });
  const body = await event.request.json();
  const email = (body.email || '').toString().toLowerCase().trim();
  const role_id = body.role_id || null;
  if (!email) return json({ error: 'email required' }, { status: 400 });

  const { data, error } = await sbServer.from('allowed_emails').insert({ email, role_id }).select().limit(1);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ email: (data && data[0]) || null });
}

export async function DELETE(event: any) {
  if (!(await requireAdmin(event))) return json({ error: 'Forbidden' }, { status: 403 });
  const body = await event.request.json();
  const id = body.id;
  if (!id) return json({ error: 'id required' }, { status: 400 });

  const { error } = await sbServer.from('allowed_emails').delete().eq('id', id);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true });
}

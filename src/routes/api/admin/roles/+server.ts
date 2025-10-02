import { json } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { requireAdmin } from '$lib/admin';

// GET /api/admin/roles - list roles
export async function GET() {
  // no event param in this signature; we'll expose a simple GET used by client UI which is public for now
  const { data, error } = await sbServer.from('roles').select('*').order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ roles: data || [] });
}

// POST /api/admin/roles - create role
export async function POST(event: any) {
  if (!(await requireAdmin(event))) return json({ error: 'Forbidden' }, { status: 403 });
  const body = await event.request.json();
  const name = (body.name || '').toString().trim();
  const permissions = body.permissions || {};
  if (!name) return json({ error: 'name required' }, { status: 400 });

  const { data, error } = await sbServer.from('roles').insert({ name, permissions }).select().limit(1);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ role: (data && data[0]) || null });
}

// PUT /api/admin/roles - update role
export async function PUT(event: any) {
  if (!(await requireAdmin(event))) return json({ error: 'Forbidden' }, { status: 403 });
  const body = await event.request.json();
  const id = body.id;
  const name = body.name;
  const permissions = body.permissions;
  if (!id) return json({ error: 'id required' }, { status: 400 });

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (permissions !== undefined) updates.permissions = permissions;

  const { data, error } = await sbServer.from('roles').update(updates).eq('id', id).select().limit(1);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ role: (data && data[0]) || null });
}

// DELETE /api/admin/roles - delete role
export async function DELETE(event: any) {
  if (!(await requireAdmin(event))) return json({ error: 'Forbidden' }, { status: 403 });
  const body = await event.request.json();
  const id = body.id;
  if (!id) return json({ error: 'id required' }, { status: 400 });

  const { error } = await sbServer.from('roles').delete().eq('id', id);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true });
}

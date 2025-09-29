import type { RequestHandler } from './$types';
import { sbServer } from '$lib/supabase';
import { parseCurrency } from '$lib/parseCurrency';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (userId) {
      const { data, error } = await sbServer.from('Customers').select('ID,Name,Balance').eq('ID', userId).maybeSingle();
      if (error) {
        console.error('Supabase error fetching customer by ID:', error);
        return new Response(JSON.stringify({ error: 'Error al obtener usuario' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      if (!data) {
        return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
  return new Response(JSON.stringify({ balance: parseCurrency(data.Balance), name: data.Name || '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const { data, error } = await sbServer.from('Customers').select('ID,Name,Balance');
    if (error) {
      console.error('Supabase error fetching customers:', error);
      return new Response(JSON.stringify({ error: 'Error al obtener usuarios' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  const users = (data || []).map((r: any) => ({ id: String(r.ID), name: r.Name, balance: parseCurrency(r.Balance) }));
    return new Response(JSON.stringify(users), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Unexpected error in /api/sheets/users:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

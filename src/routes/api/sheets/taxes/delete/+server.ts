import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, code } = body;
    if (!id && !code) {
      return new Response(JSON.stringify({ error: 'id o code es requerido para eliminar' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (id) {
      const numericId = Number(id);
  const { error } = await sbServer.from('Taxes').delete().eq('ID', numericId);
      if (error) {
        console.error('Error deleting tax type by ID:', error);
        return new Response(JSON.stringify({ error: 'Error eliminando tipo de impuesto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // delete by code
  const { error } = await sbServer.from('Taxes').delete().eq('Code', String(code));
    if (error) {
      console.error('Error deleting tax type by code:', error);
      return new Response(JSON.stringify({ error: 'Error eliminando tipo de impuesto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in taxes/delete:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sbServer } from '$lib/supabase';
import { parseCurrency } from '$lib/parseCurrency';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      throw error(400, {
        message: 'ID de usuario requerido'
      });
    }

    const { data, error: err } = await sbServer.from('Customers').select('Balance').eq('ID', userId).maybeSingle();
    if (err) {
      console.error('Supabase error fetching balance:', err);
      return json({ success: false, error: 'Error al obtener saldo' }, { status: 500 });
    }
    if (!data) return json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });

  return json({ success: true, balance: parseCurrency(data.Balance) });
  } catch (err) {
    console.error('Error en el endpoint de saldo:', err);
    return json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
};

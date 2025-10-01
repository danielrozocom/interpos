import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const GET: RequestHandler = async () => {
  try {
  const { data: rows, error } = await sbServer.from('Taxes').select('ID,Code,Name,Mode,DefaultValue,Description');
    if (error) {
      console.error('Supabase error fetching tax types:', error);
      return new Response(JSON.stringify({ success: false, error: 'Error al consultar tipos de impuestos' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const taxes = (rows || []).map((row: any) => ({
      id: String(row.ID ?? ''),
      code: row.Code ?? '',
      name: row.Name ?? '',
      mode: row.Mode ?? '',
      defaultValue: typeof row.DefaultValue === 'number' ? row.DefaultValue : Number(row.DefaultValue ?? 0),
      description: row.Description ?? ''
    }));

    return new Response(JSON.stringify({ success: true, taxes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in taxes GET:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

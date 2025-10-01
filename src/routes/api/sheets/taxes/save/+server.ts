import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, code, name, mode, defaultValue, description } = body;

    // Basic validation
    if (!code || !name || !mode) {
      return new Response(JSON.stringify({ error: 'code, name y mode son obligatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (!['PERCENT', 'AMOUNT'].includes(String(mode))) {
      return new Response(JSON.stringify({ error: 'mode debe ser PERCENT o AMOUNT' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const creating = body.creating === true;

    // Normalize defaultValue: accept string or number. For PERCENT, store decimal (0.19). For AMOUNT, store number as-is.
    let normalizedDefault: number = 0;
    if (defaultValue !== undefined && defaultValue !== null) {
      const dv = defaultValue;
      let parsed = NaN;
      if (typeof dv === 'number') parsed = dv;
      else if (typeof dv === 'string') {
        const raw = dv.trim();
        if (raw.endsWith('%')) {
          parsed = parseFloat(raw.slice(0, -1).replace(',', '.')) / 100;
        } else {
          parsed = parseFloat(raw.replace(',', '.'));
        }
      }
      if (!isNaN(parsed)) {
        if (String(mode) === 'PERCENT') {
          // if user sent 19 (not 0.19) convert to 0.19
          if (parsed > 1) parsed = parsed / 100;
          normalizedDefault = parsed;
        } else {
          normalizedDefault = parsed;
        }
      }
    }

    // On create, ensure code is unique
    if (creating) {
  const { data: existing, error: selectErr } = await sbServer.from('Taxes').select('ID').eq('Code', String(code)).maybeSingle();
      if (selectErr) {
        console.error('Error checking existing tax code:', selectErr);
        return new Response(JSON.stringify({ error: 'Error verificando tipo de impuesto existente' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      if (existing) {
        return new Response(JSON.stringify({ error: 'El código ya existe' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }

  const insertObj: any = { Code: String(code), Name: String(name), Mode: String(mode), DefaultValue: normalizedDefault, Description: description ?? '' };
  const { data: insertData, error: insertErr } = await sbServer.from('Taxes').insert([insertObj]).select().limit(1).maybeSingle();
      if (insertErr) {
        console.error('Error inserting tax type:', insertErr);
        return new Response(JSON.stringify({ error: 'Error creando tipo de impuesto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, tax: insertData || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Update existing by ID or Code
    if (id) {
      const numericId = Number(id);
  const updateObj: any = { Code: String(code), Name: String(name), Mode: String(mode), DefaultValue: normalizedDefault, Description: description ?? '' };
  const { error: updateErr } = await sbServer.from('Taxes').update(updateObj).eq('ID', numericId);
      if (updateErr) {
        console.error('Error updating tax type:', updateErr);
        return new Response(JSON.stringify({ error: 'Error actualizando tipo de impuesto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // If no ID provided, attempt to upsert by code
  const { error: upsertErr } = await sbServer.from('Taxes').upsert([{ Code: String(code), Name: String(name), Mode: String(mode), DefaultValue: normalizedDefault, Description: description ?? '' }], { onConflict: 'Code' });
    if (upsertErr) {
      console.error('Error upserting tax type:', upsertErr);
      return new Response(JSON.stringify({ error: 'Error guardando tipo de impuesto' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in taxes/save:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

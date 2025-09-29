import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';
import { parseCurrency } from '$lib/parseCurrency';

/** POST /api/sheets/recharge - Registra una recarga en la tabla Transactions_Balance y actualiza Customers.balance */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, quantity, newBalance, method, observations } = await request.json();

    if (!userId) return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    // Fecha y hora en formato sencillo (ISO)
    const now = new Date();
    const date = now.toISOString();

  // normalize previous balance in case inputs are strings with currency chars
  const prevBalance = parseCurrency(newBalance) - parseCurrency(quantity);

    // Insert transaction (flexible table name)
    try {
      const balanceSrc = await fromFlexible('Transactions_Balance');
      const { error: insertErr } = await balanceSrc.from().insert([{
      Date: date,
      Time: date,
      UserID: Number(userId),
      Name: null,
      Quantity: String(quantity),
      PrevBalance: String(prevBalance),
      NewBalance: String(newBalance),
      Method: method || null,
      Observations: observations || null
    }]);
      if (insertErr) {
        console.error('Supabase error inserting transaction:', insertErr);
        return new Response(JSON.stringify({ error: 'Error al registrar transacción' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('Error locating/inserting into Transactions_Balance:', e);
      return new Response(JSON.stringify({ error: 'Error al registrar transacción' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Update customer balance
    const { error: updateErr } = await sbServer.from('Customers').update({ Balance: String(newBalance) }).eq('ID', Number(userId));
    if (updateErr) {
      console.error('Supabase error updating customer balance:', updateErr);
      // Not fatal for the endpoint, but log
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error en el endpoint de recarga:', error);
    return new Response(JSON.stringify({ error: 'Error al registrar la recarga. Detalles: ' + String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

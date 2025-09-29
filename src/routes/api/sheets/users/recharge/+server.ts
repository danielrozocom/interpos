import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';
import { parseCurrency } from '$lib/parseCurrency';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, quantity, newBalance, method, observations } = await request.json();

    if (!userId) return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const { data: user, error } = await sbServer.from('Customers').select('ID,Name,Balance').eq('ID', Number(userId)).maybeSingle();
    if (error) {
      console.error('Supabase error fetching customer:', error);
      return new Response(JSON.stringify({ error: 'Error al buscar usuario' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (!user) return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const prevBalance = parseCurrency(user.Balance);

    // Insert into Transactions_Balance
    const now = new Date();
    const dateIso = now.toISOString();

    try {
      const balanceSrc = await fromFlexible('Transactions_Balance');
      const { error: insertErr } = await balanceSrc.from().insert([{ Date: dateIso, Time: dateIso, UserID: Number(userId), Name: user.Name, Quantity: String(quantity), PrevBalance: String(prevBalance), NewBalance: String(newBalance), Method: method || null, Observations: observations || null }]);
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
    if (updateErr) console.error('Supabase error updating customer balance:', updateErr);

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in users/recharge:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

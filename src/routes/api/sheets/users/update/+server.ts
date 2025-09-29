import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';
import { parseCurrency } from '$lib/parseCurrency';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, newBalance, userBalance, cartTotal, orderID } = await request.json();
    if (!userId) return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

    const { data: user, error } = await sbServer.from('Customers').select('ID,Name,Balance').eq('ID', Number(userId)).maybeSingle();
    if (error) {
      console.error('Supabase fetch error:', error);
      return new Response(JSON.stringify({ error: 'Error buscando usuario' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (!user) return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  const prevBalance = parseCurrency(user.Balance);

    // Update customer balance
    const { error: updateErr } = await sbServer.from('Customers').update({ Balance: String(newBalance) }).eq('ID', Number(userId));
    if (updateErr) console.error('Supabase update error:', updateErr);

    // Log transaction in Transactions_Balance (flexible name)
    const now = new Date();
    const dateIso = now.toISOString();
    try {
      const balanceSrc = await fromFlexible('Transactions_Balance');
      const { error: insertErr } = await balanceSrc.from().insert([{
        Date: dateIso,
        Time: dateIso,
        UserID: Number(userId),
        Name: user.Name,
        Quantity: String(-cartTotal),
        PrevBalance: String(prevBalance),
        NewBalance: String(newBalance),
        Method: '-',
        Observations: orderID ? `Compra #${orderID}` : 'Compra'
      }]);
      if (insertErr) console.error('Supabase insert error:', insertErr);
    } catch (e) {
      console.error('Error locating/inserting into Transactions_Balance:', e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error in users/update:', error);
    return new Response(JSON.stringify({ error: 'Error interno' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

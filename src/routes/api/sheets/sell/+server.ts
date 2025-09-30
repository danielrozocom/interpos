import type { RequestHandler } from './$types';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';
import { parseCurrency } from '$lib/parseCurrency';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, productId, quantity, total } = await request.json();

    if (!userId || !productId || typeof quantity === 'undefined' || typeof total === 'undefined') {
      return new Response(JSON.stringify({ success: false, error: 'Faltan datos requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const qty = Number(quantity);
    const amount = Number(total);
    if (Number.isNaN(qty) || Number.isNaN(amount)) {
      return new Response(JSON.stringify({ success: false, error: 'quantity y total deben ser numéricos' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Fetch customer
    const { data: user, error: userErr } = await sbServer.from('Customers').select('ID,Name,Balance').eq('ID', Number(userId)).maybeSingle();
    if (userErr) {
      console.error('Supabase error fetching customer:', userErr);
      return new Response(JSON.stringify({ success: false, error: 'Error al buscar usuario' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'Usuario no encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Optional: fetch product info
    const { data: product, error: prodErr } = await sbServer.from('Products').select('ID,Name,Price').eq('ID', Number(productId)).maybeSingle();
    if (prodErr) console.error('Supabase error fetching product:', prodErr);

  const currentBalance = parseCurrency(user.Balance);
    if (currentBalance < amount) {
      return new Response(JSON.stringify({ success: false, error: 'Saldo insuficiente' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const newBalance = currentBalance - amount;

    // Update customer balance
    const { error: updateErr } = await sbServer.from('Customers').update({ Balance: String(newBalance) }).eq('ID', Number(userId));
    if (updateErr) {
      console.error('Supabase error updating customer balance:', updateErr);
      return new Response(JSON.stringify({ success: false, error: 'Error actualizando balance' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Log transaction in Transactions_Balance (reuse balance transactions table, flexible name)
    const now = new Date();
    const dateIso = now.toISOString();
    try {
      let balanceSrc;
      try {
        balanceSrc = await fromFlexible('Transactions_Balance');
      } catch (inner) {
        console.warn('fromFlexible failed for Transactions_Balance, trying "Transactions - Balance"', inner);
        balanceSrc = await fromFlexible('Transactions - Balance');
      }
      const { error: insertErr } = await balanceSrc.from().insert([{ Date: dateIso, Time: dateIso, UserID: Number(userId), Name: user.Name, Quantity: String(-Math.abs(amount)), PrevBalance: String(currentBalance), NewBalance: String(newBalance), Method: '-', Observations: product ? `Compra ${product.Name} (ID ${product.ID})` : `Compra producto ${productId}` }]);
      if (insertErr) {
        console.error('Supabase error inserting transaction:', insertErr);
        // Not fatal for the response but log and return error
        return new Response(JSON.stringify({ success: false, error: 'Error registrando transacción' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('Error locating/inserting into Transactions_Balance or Transactions - Balance:', e);
      return new Response(JSON.stringify({ success: false, error: 'Error registrando transacción' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, newBalance }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Error processing sale:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error al procesar la venta' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

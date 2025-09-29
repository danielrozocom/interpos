import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';

// GET: Obtener el siguiente número de orden
export const GET: RequestHandler = async () => {
  try {
    // Using Supabase backend for orders

    // Query Supabase to get the max OrderID from Transactions_Orders (flexible name)
    let data: any[] = [];
    try {
      const ordersSrc = await fromFlexible('Transactions_Orders');
      const { data: _data, error } = await ordersSrc.from().select('OrderID').not('OrderID', 'is', null);
      if (error) {
        console.error('Error querying Transactions_Orders:', error);
        return json({ success: false, error: 'Error querying orders' }, { status: 500 });
      }
      data = _data || [];
    } catch (e) {
      console.error('Error locating Transactions_Orders:', e);
      return json({ success: false, error: 'Error querying orders' }, { status: 500 });
    }

    const orderNumbers = (data || [])
      .map((r: any) => Number(r.OrderID))
      .filter((n: number) => !isNaN(n) && isFinite(n));

    let nextOrderNumber = orderNumbers.length > 0 ? Math.max(...orderNumbers) + 1 : 1;
    const formattedOrderId = nextOrderNumber.toString().padStart(6, '0');

    // NO registrar automáticamente el OrderID aquí - se registrará cuando se complete la transacción

    return json({
      success: true,
      nextOrderId: formattedOrderId,
      nextNumber: nextOrderNumber
    });

  } catch (error) {
    console.error('Error obteniendo próximo OrderID:', error);
    return json({
      success: false,
      error: 'Error al generar el próximo número de orden'
    }, { status: 500 });
  }
};
// Note: previously this file re-exported a migrated sheets handler. The handler
// is implemented above and the legacy re-export was removed as part of the
// migration to use Supabase-backed handlers.

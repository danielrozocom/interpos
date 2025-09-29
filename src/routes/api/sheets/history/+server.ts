import { formatDateOnly, formatTimeOnly } from '$lib/date-utils';
import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';

// GET /api/sheets/history?userId=xxx
export const GET: RequestHandler = async ({ url }) => {
  const userId = url.searchParams.get('userId');
  if (!userId) {
    return new Response(JSON.stringify([]), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    // Query Transactions_Balance from Supabase (flexible name)
    let rows: any[] = [];
    try {
      const balanceSrc = await fromFlexible('Transactions_Balance');
      const { data: _rows, error } = await balanceSrc.from().select('Date,Time,UserID,Name,Quantity,PrevBalance,NewBalance,Method,Observations').eq('UserID', Number(userId));
      if (error) {
        console.error('Error querying Transactions_Balance:', error);
        return new Response(JSON.stringify({ error: 'Error al consultar el historial' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      rows = _rows || [];
    } catch (e) {
      console.error('Error locating Transactions_Balance:', e);
      return new Response(JSON.stringify({ error: 'Error al consultar el historial' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    console.log('=== DEBUG HISTORY API ===');
    console.log('Total filas leídas:', rows.length);
    if (rows.length > 0) {
      console.log('Primeras 3 filas:', rows.slice(0, 3));
      console.log('UserIDs encontrados (primeras 10):', rows.slice(0, 10).map(r => r.UserID));
    }
    const history = (rows || []).map((row: any) => {
      const dateStr = row.Date || '';
      const timeStr = row.Time || '';
      let combinedDateTime = '';
      try {
        if (dateStr && timeStr) {
          const dateTimeString = `${dateStr}T${timeStr}`;
          const dateTime = new Date(dateTimeString);
          if (!isNaN(dateTime.getTime())) combinedDateTime = dateTime.toISOString();
        }
      } catch (e) {
        console.error('Error combining date/time:', e);
      }
      return {
        DateTime: combinedDateTime,
        Date: dateStr,
        Time: timeStr,
        dateOnly: dateStr,
        timeOnly: timeStr,
        UserID: String(row.UserID || ''),
        Name: row.Name || '',
        Quantity: row.Quantity || '0',
        PrevBalance: row.PrevBalance || '0',
        NewBalance: row.NewBalance || '0',
        Method: row.Method || '',
        'Observation(s)': row.Observations || ''
      };
    });

    return new Response(JSON.stringify(history), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en el endpoint de historial:', error);
    return new Response(JSON.stringify({ error: 'Error al consultar el historial. Detalles: ' + String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

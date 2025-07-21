import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import { formatDateOnly, formatTimeOnly } from '$lib/date-utils';
import type { RequestHandler } from '@sveltejs/kit';

const auth = new google.auth.GoogleAuth({
  // En desarrollo usa el archivo, en producción usa variables de entorno
  credentials: process.env.NODE_ENV === 'production' ? {
    type: 'service_account',
    project_id: 'interpos-465317',
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  } : undefined,
  keyFile: process.env.NODE_ENV === 'production' ? undefined : 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = GOOGLE_SHEETS_ID;

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
    // Read all rows from Transactions - Balance
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Balance!A2:I' // Ahora son 9 columnas: Date, Time, UserID, Name, Quantity, PrevBalance, NewBalance, Method, Observation(s)
    });
    const rows = res.data.values || [];
    console.log('=== DEBUG HISTORY API ===');
    console.log('Total filas leídas:', rows.length);
    if (rows.length > 0) {
      console.log('Primeras 3 filas:', rows.slice(0, 3));
      console.log('UserIDs encontrados (primeras 10):', rows.slice(0, 10).map(r => r[2]));
    }
    // Columns: Date, Time, UserID, Name, Quantity, PrevBalance, NewBalance, Method, Observation(s)
    const history = rows
      .filter(row => row[2] === userId)
      .map(row => {
        const dateStr = row[0] ?? '';
        const timeStr = row[1] ?? '';
        // Combinar date y time para crear un DateTime ISO
        let combinedDateTime = '';
        try {
          if (dateStr && timeStr) {
            // Crear fecha combinada
            const dateTimeString = `${dateStr} ${timeStr}`;
            const dateTime = new Date(dateTimeString);
            if (!isNaN(dateTime.getTime())) {
              combinedDateTime = dateTime.toISOString();
            }
          }
        } catch (error) {
          console.error('Error combining date and time:', { dateStr, timeStr, error });
        }
        return {
          DateTime: combinedDateTime,
          Date: dateStr,
          Time: timeStr,
          dateOnly: formatDateOnly(combinedDateTime),
          timeOnly: formatTimeOnly(combinedDateTime),
          UserID: row[2] ?? '',
          Name: row[3] ?? '',
          Quantity: row[4] ?? '0',
          PrevBalance: row[5] ?? '0',
          NewBalance: row[6] ?? '0',
          Method: row[7] ?? '',
          "Observation(s)": row[8] ?? ''
        };
      });
    console.log('Filas filtradas por userId:', history.length);
    if (history.length > 0) {
      console.log('Primeras 2 transacciones filtradas:', history.slice(0, 2));
    }
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

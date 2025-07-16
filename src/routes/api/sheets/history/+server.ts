import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
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
      range: 'Transactions - Balance!A2:H'
    });
    const rows = res.data.values || [];
    // Columns: Date, UserID, Name, Quantity, PrevBalance, NewBalance, Method, Observation(s)
    const history = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        Date: row[0] ?? '',
        UserID: row[1] ?? '',
        Name: row[2] ?? '',
        Quantity: row[3] ?? '0',
        PrevBalance: row[4] ?? '0',
        NewBalance: row[5] ?? '0',
        Method: row[6] ?? '',
        "Observation(s)": row[7] ?? ''
      }));
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

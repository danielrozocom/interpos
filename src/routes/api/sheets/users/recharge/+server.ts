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

/** POST /api/sheets/users/recharge - Actualiza el saldo del usuario y registra la transacción de recarga */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, quantity, newBalance, method, observations } = await request.json();
    
    // 1. Buscar el índice de la fila del usuario
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:A'
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(([id]) => id === userId);
    
    if (rowIndex === -1) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // La fila real en la hoja (A2 es la fila 2)
    const sheetRow = rowIndex + 2;
    
    // 2. Actualizar el saldo en la columna C de Users
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Users!C${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[newBalance]] }
    });
    
    // 3. Registrar la transacción en Transactions - Balance
    const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota', hour12: false }).replace(' ', 'T');
    const prevBalance = newBalance - Number(quantity);
    const obs = observations ?? '';
    
    // Format numbers for Sheets (rounded, dot as decimal, comma as thousands)
    function formatNumber(n: number): string {
      return (isNaN(n) ? 0 : Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    const transactionValues = [[
      date,
      userId,
      formatNumber(quantity),
      formatNumber(prevBalance),
      formatNumber(newBalance),
      method,
      obs
    ]];
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Balance!A2:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: transactionValues }
    });
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en el endpoint de recarga:', error);
    return new Response(JSON.stringify({ error: 'Error al procesar la recarga. Detalles: ' + String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

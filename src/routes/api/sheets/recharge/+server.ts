import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

// Autenticación
const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = GOOGLE_SHEETS_ID;

/** POST /api/sheets/recharge - Registra una recarga en la hoja Transactions - Balance */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, quantity, newBalance, method, observations } = await request.json();
    // Fecha en GMT-5 (Bogotá)
    const date = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota', hour12: false }).replace(' ', 'T');
    const obs = observations ?? '';
    // Calculate previous balance
    const prevBalance = newBalance - Number(quantity);
    // Format numbers for Sheets (rounded, dot as decimal, comma as thousands)
    function formatNumber(n: number): string {
      return (isNaN(n) ? 0 : Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const values = [[
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
      requestBody: { values }
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

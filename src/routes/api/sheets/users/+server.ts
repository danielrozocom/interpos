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

/** GET /api/sheets/users - Devuelve todos los usuarios de la hoja de cálculo */
export const GET: RequestHandler = async () => {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:C'
    });
    const rows = res.data.values || [];
    const users = rows.map(([id, name, balance]) => {
      // Elimina el signo peso y cualquier carácter no numérico excepto punto y menos
      let cleanBalance = typeof balance === 'string' ? balance.replace(/[^\d.-]/g, '') : balance;
      return {
        id,
        name,
        balance: cleanBalance !== undefined && cleanBalance !== '' && !isNaN(Number(cleanBalance)) ? Number(cleanBalance) : 0
      };
    });
    return new Response(JSON.stringify(users), {
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

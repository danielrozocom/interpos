import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

// Autenticación
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

/** POST /api/sheets/recharge - Registra una recarga en la hoja Transactions - Balance */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, quantity, newBalance, method, observations } = await request.json();
    
    // Obtener el nombre del usuario desde la hoja Users
    let userName = '';
    try {
      const usersRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Users!A:B'
      });
      const usersRows = usersRes.data.values || [];
      const userRow = usersRows.find(row => row[0] === userId);
      userName = userRow ? (userRow[1] || '') : '';
    } catch (error) {
      console.warn('No se pudo obtener el nombre del usuario:', error);
      userName = '';
    }
    
    // Fecha en formato estándar del sistema
    const now = new Date();
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    const day = now.getDate().toString().padStart(2, '0');
    const month = monthsShort[now.getMonth()];
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    
    hours = hours % 12;
    if (hours === 0) hours = 12;
    
    const date = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}${ampm}`;
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
      userName || '',
      formatNumber(quantity),
      formatNumber(prevBalance),
      formatNumber(newBalance),
      method,
      obs
    ]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Balance!A2:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en el endpoint de recarga:', error);
    return new Response(JSON.stringify({ error: 'Error al registrar la recarga. Detalles: ' + String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

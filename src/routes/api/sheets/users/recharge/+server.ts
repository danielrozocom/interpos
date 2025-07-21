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
    
    // 1. Buscar el índice de la fila del usuario y obtener su nombre
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Users!A2:B'
    });
    const rows = res.data.values || [];
    const userRow = rows.find(([id]) => id === userId);
    
    if (!userRow) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const userName = userRow[1] || '';
    const rowIndex = rows.findIndex(([id]) => id === userId);
    
    console.log('Recharge data:', { userId, userName, quantity, newBalance, method });
    
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
    const now = new Date();
    
    // Crear Date y Time separados en zona horaria de Colombia
    const gmt5Date = new Date(now.toLocaleString("en-US", {timeZone: "Etc/GMT+5"}));
    const dateStr = gmt5Date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const timeStr = gmt5Date.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS format
    
    const prevBalance = newBalance - Number(quantity);
    const obs = observations ?? '';
    
    // Format numbers for Sheets (rounded, dot as decimal, comma as thousands)
    function formatNumber(n: number): string {
      return (isNaN(n) ? 0 : Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    const transactionValues = [[
      dateStr,      // Date en formato YYYY-MM-DD (columna A)
      timeStr,      // Time en formato HH:MM:SS (columna B)
      userId,       // UserID (columna C)
      userName,     // Name (columna D)
      formatNumber(quantity),    // Quantity (columna E)
      formatNumber(prevBalance), // PrevBalance (columna F)
      formatNumber(newBalance),  // NewBalance (columna G)
      method,       // Method (columna H)
      obs           // Observation(s) (columna I)
    ]];
    
    console.log('Values to insert in Transactions - Balance:', transactionValues);
    
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Balance!A:I', // Ahora son 9 columnas: Date, Time, UserID, Name, Quantity, PrevBalance, NewBalance, Method, Observation(s)
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

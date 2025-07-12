import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
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
      range: 'Transactions - Balance!A2:G'
    });
    const rows = res.data.values || [];
    // Columns: Date, UserID, Quantity, PrevBalance, NewBalance, Method, Observation(s)
    const history = rows
      .filter(row => row[1] === userId)
      .map(row => ({
        Date: row[0] ?? '',
        UserID: row[1] ?? '',
        Quantity: row[2] ?? '0',
        PrevBalance: row[3] ?? '0',
        NewBalance: row[4] ?? '0',
        Method: row[5] ?? '',
        "Observation(s)": row[6] ?? ''
      }));
    return new Response(JSON.stringify(history), {
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

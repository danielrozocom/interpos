import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const auth = new google.auth.GoogleAuth({
  credentials: process.env.NODE_ENV === 'production' ? {
    type: 'service_account',
    project_id: 'interpos-465317',
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, '\n'),
  } : undefined,
  keyFile: process.env.NODE_ENV === 'production' ? undefined : 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = GOOGLE_SHEETS_ID;

// GET /api/sheets/products
export const GET: RequestHandler = async () => {
  try {
    // Read all rows from Products sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'products!A2:D'
    });
    const rows = res.data.values || [];
    // Columns: ID, Category, Name, Price
    const products = rows.map(row => ({
      id: row[0] ?? '',
      category: row[1] ?? '',
      name: row[2] ?? '',
      price: Number(row[3] ?? '0')
    }));
    return new Response(JSON.stringify({ success: true, products }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error en el endpoint de productos:', error);
    return new Response(JSON.stringify({ success: false, error: 'Error al consultar productos. Detalles: ' + String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

// Autenticación
import { json } from '@sveltejs/kit';
import { GOOGLE_SHEETS_ID, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL } from '$env/static/private';

// Read credentials from environment variable
// Build credentials object from separate env variables
const credentials = {
  type: 'service_account',
  project_id: GOOGLE_PROJECT_ID,
  private_key_id: '', // optional, not needed for auth
  private_key: GOOGLE_PRIVATE_KEY,
  client_email: GOOGLE_CLIENT_EMAIL,
  client_id: '', // optional, not needed for auth
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: '', // optional
  universe_domain: 'googleapis.com'
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
    // Devuelve array vacío en caso de error para evitar fallos en frontend
    return new Response(JSON.stringify([]), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

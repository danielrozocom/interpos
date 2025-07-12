import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } from '$env/static/private';

// Configuración de autenticación que funciona tanto en desarrollo como en producción
export function getGoogleAuth() {
  try {
    // Intentar usar variables de entorno primero (producción)
    if (GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY) {
      return new google.auth.GoogleAuth({
        credentials: {
          client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Convertir \\n a saltos de línea reales
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    }
    
    // Fallback al archivo (desarrollo local)
    return new google.auth.GoogleAuth({
      keyFile: 'service-account.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } catch (error) {
    console.error('Error configurando Google Auth:', error);
    throw new Error('No se pudo configurar la autenticación de Google');
  }
}

export const auth = getGoogleAuth();
export const sheets = google.sheets({ version: 'v4', auth });
export const SPREADSHEET_ID = GOOGLE_SHEETS_ID;

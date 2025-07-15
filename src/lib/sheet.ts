// src/lib/sheets.ts
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAMES } from './config';
import { GOOGLE_PRIVATE_KEY, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SHEET_ID } from './server/config';

let doc: GoogleSpreadsheet | null = null;
let loadPromise: Promise<void> | null = null;

// Initialize Google Sheets connection
async function initialize() {
  if (!doc) {
    try {
      if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
        throw new Error('Missing required Google Sheets configuration');
      }

      const auth = new JWT({
        email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, auth);
      await doc.loadInfo();
    } catch (error) {
      console.error('Error initializing Google Sheets:', error);
      throw new Error('Failed to initialize Google Sheets');
    }
  }
}

// Get or create the loading promise
function getLoadPromise() {
  if (!loadPromise) {
    loadPromise = initialize();
  }
  return loadPromise;
}

// Get the document instance
export async function getDoc() {
  await getLoadPromise();
  return doc;
}

// Obtener el balance de un usuario
export async function getUserBalance(userId: string): Promise<number> {
	const doc = await getDoc();
	if (!doc) {
		throw new Error('Google Sheets document is not initialized');
	}
	const sheet = doc.sheetsByTitle[SHEET_NAMES.users];
	if (!sheet) {
		throw new Error(`Sheet with title ${SHEET_NAMES.users} not found`);
	}
	const rows = await sheet.getRows();
	const userRow = rows.find(row => row.get('id') === userId);
	if (!userRow) {
		throw new Error(`User with ID ${userId} not found`);
	}
	return parseFloat(userRow.get('balance'));
}

// Export sheet names for use in API routes
export { SHEET_NAMES };

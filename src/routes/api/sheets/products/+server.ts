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

function parsePrice(priceStr: string | null | undefined): number {
  if (!priceStr) return 0;
  
  // Remove currency symbols, spaces and other non-numeric characters except . and ,
  const clean = priceStr.replace(/[^\d.,-]/g, '').replace(/\s/g, '');
  
  // Handle different number formats
  if (/^-?\d+$/.test(clean)) {
    // Integer
    return parseInt(clean, 10);
  }
  
  let normalizedNumber = clean;
  
  // Handle different decimal formats
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(clean)) {
    // Format: 1.234,56
    normalizedNumber = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(clean)) {
    // Format: 1,234.56
    normalizedNumber = clean.replace(/,/g, '');
  } else if (clean.includes(',') && !clean.includes('.')) {
    // Format: 1234,56
    normalizedNumber = clean.replace(',', '.');
  }
  
  const parsed = parseFloat(normalizedNumber);
  return isNaN(parsed) ? 0 : parsed;
}

// GET /api/sheets/products
export const GET: RequestHandler = async ({ url }) => {
  try {
    // Read all rows from Products sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'products!A2:D'
    });
    const rows = res.data.values || [];
    // Columns: ID, Category, Name, Price
    let products = rows.map(row => ({
      id: row[0] ?? '',
      category: row[1] ?? '',
      name: row[2] ?? '',
      price: parsePrice(row[3])
    }));      // Adjust prices (API sends prices as 5.5 which means $5,500)
      products = products.map(product => {
        let parsedPrice = 0;
        if (typeof product.price === 'number' && !isNaN(product.price)) {
          // Convert 5.5 to 5500 by multiplying by 1000 and rounding
          parsedPrice = Math.round(product.price * 1000);
        } else if (typeof product.price === 'string') {
          // If it comes as string, convert to number and multiply
          let numPrice = parseFloat(product.price);
          parsedPrice = Math.round(numPrice * 1000);
        }
        return {
          ...product,
          price: parsedPrice
        };
      });

      // Filter products if search parameter is present
      const searchTerm = url.searchParams.get('search')?.toLowerCase();
      if (searchTerm) {
        // Primero intentar encontrar coincidencia exacta por ID
        const exactIdMatch = products.filter(product => 
          product.id.toLowerCase() === searchTerm
        );
        
        if (exactIdMatch.length > 0) {
          // Si encontramos coincidencia exacta por ID, usar esa
          products = exactIdMatch;
        } else {
          // Si no hay coincidencia exacta por ID, buscar en nombre
          const nameMatches = products.filter(product => 
            product.name.toLowerCase().includes(searchTerm)
          );
          
          if (nameMatches.length > 0) {
            // Si encontramos coincidencias por nombre, usar esas
            products = nameMatches;
          } else {
            // Si no hay coincidencias por nombre, buscar IDs que empiecen igual
            products = products.filter(product => 
              product.id.toLowerCase().startsWith(searchTerm)
            );
          }
        }
      }

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

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
      // price: parsePrice(row[3]) – guardamos también el raw para heurísticas posteriores
      price: parsePrice(row[3]),
      _raw: row[3] ?? ''
    }));

    // Ajustar precios: detectar si la celda original usa decimales para representar miles
    // Ejemplo: '5.5' -> 5500. Pero un entero como '300' no debe convertirse a 300000.
    products = products.map(product => {
  const rawVal = (product as any)._raw ?? '';
  const rawClean = String(rawVal).replace(/[^^\d.,-]/g, '').replace(/\s/g, '');
      let parsedPrice = 0;

      // Intentar extraer número desde la representación cruda
      let numFromRaw: number | null = null;
      if (rawClean) {
        let normalized = rawClean;
        if (rawClean.includes('.') && rawClean.includes(',')) {
          // 1.234,56 -> 1234.56
          normalized = rawClean.replace(/\./g, '').replace(',', '.');
        } else if (rawClean.includes(',') && !rawClean.includes('.')) {
          // 1234,56 -> 1234.56
          normalized = rawClean.replace(/,/g, '.');
        }
        const maybeNum = parseFloat(normalized);
        if (!isNaN(maybeNum)) numFromRaw = maybeNum;
      }

      const numericPrice = typeof product.price === 'number' && !isNaN(product.price) ? product.price : NaN;

      // Detectar si raw muestra decimales y el número es menor a 1000 -> probablemente notación de miles (p.ej. 5.5 => 5500)
      const looksLikeDecimalThousands = numFromRaw !== null && /[.,]/.test(String(rawVal)) && Math.abs(numFromRaw) < 1000;
      if (looksLikeDecimalThousands && numFromRaw !== null) {
        parsedPrice = Math.round(numFromRaw * 1000);
      } else if (!isNaN(numericPrice)) {
        // Ya es un número en la unidad final
        parsedPrice = Math.round(numericPrice);
      } else if (numFromRaw !== null) {
        // Fallback al número parseado desde raw
        parsedPrice = Math.round(numFromRaw);
      }

      return {
        ...product,
        price: parsedPrice
      };
    });

    // Validación del rango de precios aceptable: 300 .. 300000
    const MIN_PRICE = 300;
    const MAX_PRICE = 300000;
    // Opcional: registrar cuántos productos se excluyen por precio inválido
    const excludedCount = products.filter(p => typeof p.price !== 'number' || p.price < MIN_PRICE || p.price > MAX_PRICE).length;
    if (excludedCount > 0) {
      console.warn(`Excluyendo ${excludedCount} productos con precio fuera del rango ${MIN_PRICE}-${MAX_PRICE}`);
    }
    // Filtrar productos fuera del rango para que la UI no los muestre
    products = products.filter(p => typeof p.price === 'number' && p.price >= MIN_PRICE && p.price <= MAX_PRICE);

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

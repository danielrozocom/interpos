import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

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

// GET: Obtener el siguiente número de orden
export const GET: RequestHandler = async () => {
  try {
    // Validar que SPREADSHEET_ID esté configurado
    if (!SPREADSHEET_ID) {
      console.error('SPREADSHEET_ID no está configurado');
      return json({
        success: false,
        error: 'Configuración de hoja de cálculo no encontrada'
      }, { status: 500 });
    }
    // Obtener todas las órdenes existentes para determinar el próximo número
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!B:B', // Columna OrderID (B)
    });

    console.log('SPREADSHEET_ID:', SPREADSHEET_ID);
    console.log('Response from Google Sheets:', response.data);

    const rows = response.data.values || [];
    console.log('Raw rows from column B:', rows);
    
    // Filtrar solo los OrderIDs que sean números (excluyendo encabezado)
    const orderNumbers = rows
      .slice(1) // Saltar encabezado
      .map(row => row[0]) // Tomar el primer elemento de cada fila
      .filter(orderId => {
        console.log('Checking OrderID:', orderId);
        // Aceptar cualquier número (sin importar cantidad de dígitos)
        return orderId && /^\d+$/.test(orderId.toString());
      })
      .map(orderId => {
        const num = parseInt(orderId, 10);
        console.log('Parsed OrderID:', orderId, 'to number:', num);
        return num;
      })
      .filter(num => !isNaN(num));

    console.log('Valid order numbers extracted:', orderNumbers);

    // Encontrar el próximo número disponible (comenzar desde 1 para 000001)
    let nextOrderNumber = orderNumbers.length > 0 ? Math.max(...orderNumbers) + 1 : 1;
    
    console.log('Next order number calculated:', nextOrderNumber);

    // Formatear el OrderID con 6 dígitos (000001, 000002, etc.)
    const formattedOrderId = nextOrderNumber.toString().padStart(6, '0');
    
    console.log('Formatted OrderID:', formattedOrderId);

    // NO registrar automáticamente el OrderID aquí - se registrará cuando se complete la transacción

    return json({
      success: true,
      nextOrderId: formattedOrderId,
      nextNumber: nextOrderNumber
    });

  } catch (error) {
    console.error('Error obteniendo próximo OrderID:', error);
    return json({
      success: false,
      error: 'Error al generar el próximo número de orden'
    }, { status: 500 });
  }
};

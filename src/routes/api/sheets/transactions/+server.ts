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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { date, orderID, userID, quantity, products } = await request.json();

    // Validate required fields
    if (!date || !orderID || !userID || !quantity || !products) {
      return json({ 
        success: false, 
        error: 'Faltan campos requeridos: date, orderID, userID, quantity (valor de compra), products' 
      }, { status: 400 });
    }

    // Crear fecha y hora actual
    const now = new Date();
    const dateTimeString = now.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Prepare the row data for Google Sheets
    const values = [
      [
        dateTimeString,  // Date with time
        `'${orderID}`,   // OrderID con apóstrofe para forzar formato de texto
        userID,         // UserID
        quantity,       // Quantity (valor total de la compra)
        products        // Product(s) - formatted string
      ]
    ];

    // Add the transaction to the "Transactions - Orders" sheet
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:E', // Columns A to E
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    console.log('Transaction recorded successfully:', result.data);

    return json({ 
      success: true, 
      message: 'Transacción registrada exitosamente',
      data: {
        orderID,
        date,
        updatedCells: result.data.updates?.updatedCells || 0
      }
    });

  } catch (error: any) {
    console.error('Error recording transaction:', error);
    
    return json({ 
      success: false, 
      error: error.message || 'Error interno del servidor al registrar la transacción' 
    }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userID = url.searchParams.get('userID');
    const orderID = url.searchParams.get('orderID');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    console.log('GOOGLE_SHEETS_ID value:', GOOGLE_SHEETS_ID);

    // Get all transactions from the sheet
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:E',
    });

    const rows = result.data.values || [];
    
    if (rows.length <= 1) {
      return json({ 
        success: true, 
        transactions: [],
        message: 'No hay transacciones registradas'
      });
    }

    // Parse the data (skip header row)
    const transactions = rows.slice(1).map((row, index) => ({
      rowIndex: index + 2, // +2 because we skipped header and arrays are 0-indexed
      date: row[0] || '',
      orderID: row[1] || '',
      userID: row[2] || '',
      quantity: parseFloat(row[3]) || 0, // Valor de la compra
      products: row[4] || ''
    }));

    // Apply filters if provided
    let filteredTransactions = transactions;

    if (userID) {
      filteredTransactions = filteredTransactions.filter(t => t.userID === userID);
    }

    if (orderID) {
      filteredTransactions = filteredTransactions.filter(t => t.orderID.includes(orderID));
    }

    if (startDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date >= startDate);
    }

    if (endDate) {
      filteredTransactions = filteredTransactions.filter(t => t.date <= endDate);
    }

    return json({ 
      success: true, 
      transactions: filteredTransactions,
      total: filteredTransactions.length
    });

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    
    return json({ 
      success: false, 
      error: error.message || 'Error interno del servidor al obtener las transacciones' 
    }, { status: 500 });
  }
};

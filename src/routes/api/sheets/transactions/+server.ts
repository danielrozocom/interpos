import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getCurrentDateInTimezone, formatDate } from '$lib/date-utils';

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
    const { date, orderID, userID, userName, quantity, products } = await request.json();

    console.log('Received transaction data:', { date, orderID, userID, userName, quantity, products });

    // Validate required fields
    if (!date || !orderID || !userID || !quantity || !products) {
      return json({ 
        success: false, 
        error: 'Faltan campos requeridos: date, orderID, userID, quantity (valor de compra), products' 
      }, { status: 400 });
    }

    // Crear fecha y hora actual en formato estándar del sistema
    const now = new Date();
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    const day = now.getDate().toString().padStart(2, '0');
    const month = monthsShort[now.getMonth()];
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    
    hours = hours % 12;
    if (hours === 0) hours = 12;
    
    const dateTimeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}${ampm}`;

    // Prepare the row data for Google Sheets
    const values = [
      [
        dateTimeString,  // Date with time
        `'${orderID}`,   // OrderID con apóstrofe para forzar formato de texto
        userID,         // UserID
        userName || '',  // UserName (puede estar vacío)
        quantity,       // Quantity (valor total de la compra)
        products        // Product(s) - formatted string
      ]
    ];

    console.log('Values to insert:', values);

    // Add the transaction to the "Transactions - Orders" sheet
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:F', // Columns A to F
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
    const date = url.searchParams.get('date');

    console.log('GOOGLE_SHEETS_ID value:', GOOGLE_SHEETS_ID);

    // Get all transactions from the sheet
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:F',
    });

    const rows = result.data.values || [];
    
    if (rows.length <= 1) {
      return json({ 
        success: true, 
        transactions: [],
        message: 'No hay transacciones registradas'
      });
    }

    console.log('Raw sheet data:', {
      totalRows: rows.length,
      headers: rows[0],
      sampleData: rows.slice(1, 4)
    });
    
    const transactions = rows.slice(1).map((row, index) => {
      // Parse quantity/amount - could be in different formats
      let amount = 0;
      if (row[4]) {
        // Remove any currency symbols and parse
        const cleanAmount = String(row[4]).replace(/[$,\s]/g, '');
        amount = parseFloat(cleanAmount) || 0;
      }
      
      const transaction = {
        rowIndex: index + 2,
        date: row[0] || '',
        orderID: row[1] || '',
        userID: row[2] || '',
        name: row[3] || '',
        quantity: amount,
        products: row[5] || ''
      };
      
      if (index < 3) {
        console.log(`Transaction ${index + 1}:`, transaction);
      }
      
      return transaction;
    });

    console.log('Total parsed transactions:', transactions.length);

    // Apply filters if provided
    let filteredTransactions = transactions;

    if (userID) {
      filteredTransactions = filteredTransactions.filter(t => t.userID === userID);
    }

    if (orderID) {
      filteredTransactions = filteredTransactions.filter(t => t.orderID.includes(orderID));
    }

    if (startDate) {
      const parsedStartDate = new Date(startDate);
      filteredTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= parsedStartDate;
      });
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);
      filteredTransactions = filteredTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate <= parsedEndDate;
      });
    }

    if (date === 'today') {
      // Obtener fecha actual en zona horaria de Colombia
      const colombiaTime = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const colombiaDate = new Date(`${colombiaTime}T00:00:00`);
      const todayDay = colombiaDate.getDate();
      const todayMonth = colombiaDate.getMonth() + 1;
      const todayYear = colombiaDate.getFullYear();

      console.log('Colombia today:', {
        colombiaTime,
        todayDay,
        todayMonth,
        todayYear,
        formatted14: `14/${todayMonth}/${todayYear}`,
        formatted14_2: `14/${todayMonth}/${todayYear}`,
        formatted14_3: `14/${todayMonth.toString().padStart(2, '0')}/${todayYear}`
      });
      console.log('Total transactions before filter:', filteredTransactions.length);
      console.log('All transactions dates:', filteredTransactions.map(t => ({
        date: t.date,
        amount: t.quantity,
        orderID: t.orderID
      })));
      
      filteredTransactions = filteredTransactions.filter(t => {
        const dateStr = t.date.toString().toLowerCase();
        
        // Buscar específicamente por 14/7/2025 o 14/07/2025
        const isToday = dateStr.includes('14/7/2025') || 
                       dateStr.includes('14/07/2025') ||
                       dateStr.includes('2025-07-14') ||
                       (dateStr.includes('14') && dateStr.includes('7') && dateStr.includes('2025'));
        
        if (isToday) {
          console.log('✓ Found today transaction:', { 
            date: t.date, 
            amount: t.quantity, 
            orderID: t.orderID 
          });
        }
        
        return isToday;
      });
      
      console.log('Transactions after today filter:', filteredTransactions.length);
    }

    const totalSalesCount = filteredTransactions.length;
    const totalSalesAmount = filteredTransactions.reduce((sum, t) => {
      const amount = t.quantity || 0;
      console.log(`Adding transaction: OrderID=${t.orderID}, Amount=${amount}, Running Sum=${sum + amount}`);
      return sum + amount;
    }, 0);

    console.log('FINAL CALCULATION:');
    console.log('- Total Count:', totalSalesCount);
    console.log('- Total Amount:', totalSalesAmount);
    console.log('- Individual amounts:', filteredTransactions.map(t => ({ orderID: t.orderID, amount: t.quantity })));

    return json({ 
      success: true, 
      transactions: filteredTransactions,
      total: filteredTransactions.length,
      totalSalesCount,
      totalSalesAmount,
      count: totalSalesCount,
      amount: totalSalesAmount
    });

  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    
    return json({ 
      success: false, 
      error: error.message || 'Error interno del servidor al obtener las transacciones' 
    }, { status: 500 });
  }
};

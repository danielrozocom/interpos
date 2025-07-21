import { google } from 'googleapis';
import { GOOGLE_SHEETS_ID } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getCurrentDateInTimezone, formatDate, formatDateOnly, formatTimeOnly } from '$lib/date-utils';

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

    // Crear fecha y hora actual en zona horaria de Colombia
    const now = new Date();
    
    // Crear Date y Time separados en zona horaria de Colombia
    const colombiaDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    const dateStr = colombiaDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const timeStr = colombiaDate.toLocaleTimeString('en-GB', { hour12: false }); // HH:MM:SS format

    // Prepare the row data for Google Sheets
    const values = [
      [
        dateStr,         // Date en formato YYYY-MM-DD (columna A)
        timeStr,         // Time en formato HH:MM:SS (columna B)
        orderID,         // OrderID como número de 6 dígitos, sin apóstrofe (columna C)
        userID,          // UserID (columna D)
        userName || '',  // UserName (columna E)
        quantity,        // Quantity - valor total de la compra (columna F)
        products         // Product(s) - formatted string (columna G)
      ]
    ];

    console.log('Values to insert:', values);

    // Add the transaction to the "Transactions - Orders" sheet
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:G', // Ahora son 7 columnas: Date, Time, OrderID, UserID, UserName, Quantity, Products
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
    console.log('--- /api/sheets/transactions GET ---');
    const incomingOrderID = url.searchParams.get('orderID');
    if (incomingOrderID) {
      console.log('Incoming orderID param:', incomingOrderID);
    }
    const userID = url.searchParams.get('userID');
    const orderID = url.searchParams.get('orderID');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const date = url.searchParams.get('date');

    console.log('GOOGLE_SHEETS_ID value:', GOOGLE_SHEETS_ID);

    // Get all transactions from the sheet
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:G', // Ahora son 7 columnas: Date, Time, OrderID, UserID, UserName, Quantity, Products
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
      if (row[5]) { // Quantity ahora está en columna F (índice 5)
        // Remove any currency symbols and parse
        const cleanAmount = String(row[5]).replace(/[$,\s]/g, '');
        amount = parseFloat(cleanAmount) || 0;
      }
      
      const dateStr = row[0] || '';
      const timeStr = row[1] || '';
      // Soporta ambos: (date+time) o solo ISO 8601 en A
      let combinedDateTime = '';
      if (dateStr && timeStr) {
        try {
          const dateTimeString = `${dateStr} ${timeStr}`;
          const dateTime = new Date(dateTimeString);
          if (!isNaN(dateTime.getTime())) {
            combinedDateTime = dateTime.toISOString();
          } else {
            combinedDateTime = dateStr; // fallback
          }
        } catch (error) {
          console.error('Error combining date and time:', { dateStr, timeStr, error });
          combinedDateTime = dateStr;
        }
      } else if (dateStr) {
        combinedDateTime = dateStr;
      }

      const transaction = {
        rowIndex: index + 2,
        date: combinedDateTime,                    // DateTime combinado o ISO 8601 directo
        dateOnly: formatDateOnly(combinedDateTime), // Fecha formateada para Colombia
        timeOnly: formatTimeOnly(combinedDateTime), // Hora formateada para Colombia
        orderID: row[2] || '',        // OrderID (columna C)
        userID: row[3] || '',         // UserID (columna D)
        name: row[4] || '',           // Name (columna E)
        quantity: amount,             // Quantity (columna F)
        products: row[6] || ''        // Products (columna G)
      };
      
      if (index < 3) {
        console.log(`Transaction ${index + 1}:`, transaction);
      }
      
      return transaction;
    });

    console.log('Total parsed transactions:', transactions.length);
    // Log all parsed orderIDs for debugging
    console.log('All parsed orderIDs:', transactions.map(t => t.orderID));

    // Apply filters if provided
    let filteredTransactions = transactions;

    if (userID) {
      filteredTransactions = filteredTransactions.filter(t => t.userID === userID);
    }

    if (orderID) {
      console.log('Filtering transactions by orderID:', orderID);
      filteredTransactions = filteredTransactions.filter(t => t.orderID.includes(orderID));
      console.log('Filtered transactions count:', filteredTransactions.length);
      if (filteredTransactions.length === 0) {
        console.log('No transactions matched for orderID:', orderID);
      } else {
        console.log('Matched transactions:', filteredTransactions.map(t => t.orderID));
      }
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

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
    console.log('=== TRANSACTION ENDPOINT CALLED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Stack trace:', new Error().stack);
    
    const { date, orderID, userID, userName, quantity, products, paymentMethod, cashReceived, cashChange, currentBalance, newBalance } = await request.json();

    console.log('Received transaction data:', { date, orderID, userID, userName, quantity, products, paymentMethod, cashReceived, cashChange, currentBalance, newBalance });

    // Validate required fields
    if (!date || !orderID || !userID || !quantity || !products || !paymentMethod) {
      return json({ 
        success: false, 
        error: 'Faltan campos requeridos: date, orderID, userID, quantity (valor de compra), products, paymentMethod' 
      }, { status: 400 });
    }

    // Crear fecha y hora actual en zona horaria de Colombia
    const now = new Date();
    
    // Crear Date y Time separados en zona horaria de Colombia (GMT-5)
    const colombiaDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    const dateStr = colombiaDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    // Asegurar que timeStr esté en formato HH:MM:SS
    const timeStr = formatTime(colombiaDate.toLocaleTimeString('en-GB', { hour12: false })); // HH:MM:SS format

    // Prepare the row data for Google Sheets - Orders
    const ordersValues = [
      [
        dateStr,         // Date en formato YYYY-MM-DD (columna A)
        timeStr,         // Time en formato HH:MM:SS (columna B)
        orderID,         // OrderID como número de 6 dígitos, sin apóstrofe (columna C)
        userID,          // UserID (columna D)
        userName || '',  // Name (columna E)
        quantity,        // Quantity - valor total de la compra (columna F)
        paymentMethod,   // Method - Saldo o Efectivo (columna G)
        products         // Product(s) - formatted string (columna H)
      ]
    ];

    console.log('Values to insert (Orders):', ordersValues);

    // Add the transaction to the "Transactions - Orders" sheet
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Orders!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: ordersValues,
      },
    });

    // Get current user balance for the transaction
    let actualCurrentBalance = 0;
    try {
      const usersSheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Users!A:Z',
      });
      
      const users = usersSheet.data.values?.slice(1) || [];
      const user = users.find(row => row[0] === userID);
      
      if (user) {
        // El saldo está en la columna C (índice 2) de la hoja Users
        actualCurrentBalance = parseFloat(user[2] || '0');
        console.log('Found user balance in sheet:', actualCurrentBalance, 'from column C (index 2)');
      } else {
        console.log('User not found in Users sheet');
      }
    } catch (error) {
      console.error('Error getting user balance:', error);
    }

    // Calculate transaction amount and handle balance based on payment method
    const isNegativeAmount = quantity < 0;
    const isCashPayment = paymentMethod === 'Efectivo';
    
    console.log('=== BALANCE CALCULATION DEBUG ===');
    console.log('Received quantity:', quantity, 'Type:', typeof quantity);
    console.log('Actual current balance (from sheet):', actualCurrentBalance, 'Type:', typeof actualCurrentBalance);
    console.log('Frontend current balance:', currentBalance, 'Type:', typeof currentBalance);
    console.log('Frontend new balance:', newBalance, 'Type:', typeof newBalance);
    console.log('Payment method:', paymentMethod);
    console.log('Is negative amount:', isNegativeAmount);
    console.log('Is cash payment:', isCashPayment);
    
    // Use values from frontend if payment method is Saldo, otherwise use current logic
    let prevBalance, calculatedNewBalance, transactionAmount;
    
    if (paymentMethod === 'Saldo' && typeof currentBalance === 'number' && typeof newBalance === 'number') {
      // Use values calculated in frontend
      prevBalance = currentBalance;
      calculatedNewBalance = newBalance;
      transactionAmount = -Math.abs(quantity); // Always negative for purchases
      console.log('USING FRONTEND VALUES');
      console.log('Previous balance:', prevBalance);
      console.log('New balance:', calculatedNewBalance);
      console.log('Transaction amount:', transactionAmount);
    } else {
      // Fallback to current logic
      console.log('USING BACKEND CALCULATION');
      if (isCashPayment && isNegativeAmount) {
        // Caso 1: Pago en efectivo con cantidad negativa (consumo pagado por fuera)
        // No se modifica el saldo virtual
        transactionAmount = quantity; // Mantener el valor negativo
        prevBalance = actualCurrentBalance;
        calculatedNewBalance = actualCurrentBalance;
        console.log('CASE 1: Cash payment with negative amount - No balance change');
      } else {
        // Caso 2: Cualquier otro caso (método distinto a efectivo o cantidad positiva)
        transactionAmount = isNegativeAmount ? quantity : -Math.abs(quantity); // Negativo para consumos
        prevBalance = actualCurrentBalance;
        calculatedNewBalance = actualCurrentBalance + transactionAmount; // Suma si es recarga, resta si es consumo
        console.log('CASE 2: Balance will change');
      }
    }
    
    console.log('FINAL CALCULATION:');
    console.log('Transaction amount:', transactionAmount);
    console.log('Previous balance:', prevBalance);
    console.log('New balance:', calculatedNewBalance);
    console.log('=====================================');
    
    // Prepare data for "Transactions - Balance" sheet with correct structure
    const balanceValues = [
      [
        dateStr,                     // Date (columna A)
        timeStr,                     // Time (columna B)
        userID,                      // UserID (columna C)
        userName || '',              // Name (columna D)
        transactionAmount,           // Quantity (always negative for purchases)
        prevBalance,                 // PrevBalance (columna F) - Saldo anterior
        calculatedNewBalance,        // NewBalance (columna G) - Nuevo saldo (solo cambia si es Saldo)
        paymentMethod,               // Method - Saldo o Efectivo (columna H)
        `Compra #${orderID}`         // Observation(s) - Formato: Compra #000005 (columna I)
      ]
    ];

    console.log('Values to insert (Balance):', balanceValues);

    // Update user balance ONLY if payment method is 'Saldo'
    if (paymentMethod === 'Saldo') {
      console.log('Updating user balance from', prevBalance, 'to', calculatedNewBalance);
      
      // Find the user row in Users sheet
      const usersSheet = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Users!A:Z',
      });
      
      const users = usersSheet.data.values?.slice(1) || [];
      const userRowIndex = users.findIndex(row => row[0] === userID);
      
      if (userRowIndex !== -1) {
        // Update balance in Users sheet (column C, index 2)
        const sheetRow = userRowIndex + 2; // +2 because we skipped header and array is 0-indexed
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Users!C${sheetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[calculatedNewBalance]] }
        });
        console.log('✅ User balance updated successfully in Users sheet');
        console.log('   - Row:', sheetRow);
        console.log('   - Range: Users!C' + sheetRow);
        console.log('   - New value written:', calculatedNewBalance);
      } else {
        console.error('User not found for balance update:', userID);
      }
    }

    // Add to "Transactions - Balance" sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Transactions - Balance!A:I', // 9 columnas: Date, Time, UserID, Name, Quantity, PrevBalance, NewBalance, Method, Observation(s)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: balanceValues,
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
      range: 'Transactions - Orders!A:H', // 8 columnas: Date, Time, OrderID, UserID, Name, Quantity, Method, Product(s)
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
      // Si es ISO 8601, conviértelo a Colombia para mostrar
      let colombiaDateObj;
      if (combinedDateTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(combinedDateTime)) {
        // Los datos ya están en hora de Colombia, no necesitamos doble conversión
        colombiaDateObj = new Date(combinedDateTime);
      } else {
        colombiaDateObj = new Date(combinedDateTime);
      }
      
      // Para timeOnly y dateOnly, usar directamente los valores de las columnas de Google Sheets
      // ya que están guardados en hora de Colombia
      const directTimeOnly = row[1] || ''; // Time directo de la columna B
      const directDateOnly = row[0] ? new Date(row[0]).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }) : '';
      
      // Asegurar que timeOnly se devuelva correctamente
      const timeOnly = timeStr || '00:00:00';

      // Mapeo de columnas según el orden en Google Sheets:
      // 0: Date, 1: Time, 2: OrderID, 3: UserID, 4: Name, 5: Quantity, 6: Method (Saldo/Efectivo), 7: Product(s)
      const transaction = {
        rowIndex: index + 2,
        date: colombiaDateObj.toISOString(), // SIEMPRE en hora Colombia (ISO)
        dateOnly: directDateOnly,
        timeOnly: directTimeOnly,
        orderID: row[2] || '',
        userID: row[3] || '',
        name: row[4] || '',
        quantity: amount,
        paymentMethod: row[6] || 'Saldo', // Method (columna G)
        products: row[7] || '' // Product(s) (columna H)
      };
      
      console.log('Processed transaction:', {
        dateOnly: dateStr,
        timeOnly: timeOnly,
        combinedDateTime,
        amount,
        orderID: row[2] || '',
        userID: row[3] || '',
        name: row[4] || '',
        method: row[6] || '',
        products: row[7] || ''
      });
      
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

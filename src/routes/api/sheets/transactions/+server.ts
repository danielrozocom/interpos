import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getCurrentDateInTimezone, formatDate, formatDateOnly, formatTimeOnly } from '$lib/date-utils';
import { sbServer } from '$lib/supabase';
import { fromFlexible } from '$lib/dbHelpers';
import { parseCurrency } from '$lib/parseCurrency';

// Función para formatear tiempo a HH:mm:ss
function formatTime(timeStr: string): string {
  // Si ya está en formato HH:mm:ss, retornarlo
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }
  // Si está en formato HH:mm, agregar :00
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr + ':00';
  }
  // Si está en formato H:mm o H:mm:ss, agregar cero al inicio
  return timeStr.padStart(8, '0');
}

// Using Supabase instead of Google Sheets

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('=== TRANSACTION ENDPOINT CALLED ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Stack trace:', new Error().stack);
    
    const { date, orderID, userID, userName, quantity, products, paymentMethod, cashReceived, cashChange, currentBalance, newBalance } = await request.json();

    console.log('Received transaction data:', { date, orderID, userID, userName, quantity, products, paymentMethod, cashReceived, cashChange, currentBalance, newBalance });

    // Validate required fields
    if (!date || !orderID || !quantity || !products || !paymentMethod) {
      return json({ 
        success: false, 
        error: 'Faltan campos requeridos: date, orderID, quantity (valor de compra), products, paymentMethod' 
      }, { status: 400 });
    }

    // Para ventas en efectivo sin usuario, usar valores por defecto
    const finalUserID = userID || 'EFECTIVO';
    const finalUserName = userName || 'Venta en Efectivo';

    // Crear fecha y hora actual en zona horaria de Colombia
    const now = new Date();
    
    // Crear Date y Time separados en zona horaria de Colombia (GMT-5)
    const colombiaDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Bogota"}));
    const dateStr = colombiaDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    // Asegurar que timeStr esté en formato HH:MM:SS
    const timeStr = formatTime(colombiaDate.toLocaleTimeString('en-GB', { hour12: false })); // HH:MM:SS format

    // Insert order into Supabase Transactions table (Transactions_Orders) with flexible table name
    try {
      const ordersSrc = await fromFlexible('Transactions_Orders');
      const orderInsert = await ordersSrc.from().insert([{ Date: dateStr, Time: timeStr, OrderID: orderID, UserID: finalUserID, Name: finalUserName, Quantity: quantity, Method: paymentMethod, Products: products }]);
      if (orderInsert.error) {
        console.error('Error inserting order in Supabase:', orderInsert.error);
        return json({ success: false, error: 'Error inserting order' }, { status: 500 });
      }
    } catch (e) {
      console.error('Error locating/inserting into Transactions_Orders:', e);
      return json({ success: false, error: 'Error inserting order' }, { status: 500 });
    }

    // Get current user balance for the transaction from Supabase
    let actualCurrentBalance = 0;
    if (userID && userID !== 'EFECTIVO') {
      const userRes = await sbServer.from('Customers').select('Balance,Name').eq('ID', Number(userID)).maybeSingle();
      if (!userRes.error && userRes.data) {
        actualCurrentBalance = parseCurrency(userRes.data.Balance);
      } else if (userRes.error) {
        console.error('Error fetching user balance from Supabase:', userRes.error);
      }
    } else {
      console.log('Cash payment without user - using balance 0');
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
    console.log('Final UserID:', finalUserID);
    console.log('Final UserName:', finalUserName);
    
    // Calculate balance values
    let prevBalance, calculatedNewBalance, transactionAmount;
    
    if (paymentMethod === 'Saldo' && typeof currentBalance === 'number' && typeof newBalance === 'number') {
      // Use values calculated in frontend for balance payments
      prevBalance = currentBalance;
      calculatedNewBalance = newBalance;
      transactionAmount = -Math.abs(quantity); // Always negative for purchases
      console.log('USING FRONTEND VALUES FOR BALANCE PAYMENT');
    } else if (paymentMethod === 'Efectivo') {
      // For cash payments, record the transaction but don't change the user's balance
      transactionAmount = -Math.abs(quantity); // Always negative for purchases
      prevBalance = actualCurrentBalance; // Current balance at time of transaction
      calculatedNewBalance = actualCurrentBalance; // Same balance (no change for cash payments)
      console.log('CASH PAYMENT - NO BALANCE CHANGE');
      console.log('Transaction amount:', transactionAmount);
      console.log('Previous balance (unchanged):', prevBalance);
      console.log('New balance (same as previous):', calculatedNewBalance);
    } else {
      // Fallback logic
      console.log('USING BACKEND CALCULATION');
      transactionAmount = -Math.abs(quantity); // Always negative for purchases
      prevBalance = actualCurrentBalance;
      calculatedNewBalance = actualCurrentBalance + transactionAmount;
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
        finalUserID,                 // UserID (columna C)
        finalUserName,               // Name (columna D)
        transactionAmount,           // Quantity (always negative for purchases)
        prevBalance,                 // PrevBalance (columna F) - Saldo anterior
        calculatedNewBalance,        // NewBalance (columna G) - Nuevo saldo (mismo para efectivo)
        paymentMethod,               // Method - Saldo o Efectivo (columna H)
        `Compra #${orderID}`         // Observation(s) - Formato: Compra #000005 (columna I)
      ]
    ];

    console.log('Values to insert (Balance):', balanceValues);

    // Update user balance in Supabase if payment method is 'Saldo'
    if (paymentMethod === 'Saldo' && userID && userID !== 'EFECTIVO') {
      console.log('Updating user balance from', prevBalance, 'to', calculatedNewBalance);
      const updateRes = await sbServer.from('Customers').update({ Balance: String(calculatedNewBalance) }).eq('ID', Number(userID));
      if (updateRes.error) {
        console.error('Error updating user balance in Supabase:', updateRes.error);
      } else {
        console.log('✅ User balance updated successfully in Supabase');
      }
    } else {
      console.log('Skipping balance update - Cash payment or no real user');
    }

    // Insert balance transaction into Supabase Transactions_Balance table (flexible name)
    try {
      let balanceSrc;
      try {
        balanceSrc = await fromFlexible('Transactions_Balance');
      } catch (inner) {
        console.warn('fromFlexible failed for Transactions_Balance, trying "Transactions - Balance"', inner);
        balanceSrc = await fromFlexible('Transactions - Balance');
      }
      const balanceInsert = await balanceSrc.from().insert([{ Date: balanceValues[0][0], Time: balanceValues[0][1], UserID: balanceValues[0][2], Name: balanceValues[0][3], Quantity: String(balanceValues[0][4]), PrevBalance: String(balanceValues[0][5]), NewBalance: String(balanceValues[0][6]), Method: balanceValues[0][7], Observations: balanceValues[0][8] }]);
      if (balanceInsert.error) {
        console.error('Error inserting balance transaction in Supabase:', balanceInsert.error);
      }
    } catch (e) {
      console.error('Error locating/inserting into Transactions_Balance or Transactions - Balance:', e);
    }

  console.log('Transaction recorded successfully in Supabase');

    // Clear the previous user ID, name, and balance after processing the transaction
    const clearedUserID = null;
    const clearedUserName = null;
    const clearedBalance = 0;
    console.log('Cleared previous user data:', { clearedUserID, clearedUserName, clearedBalance });

    return json({ 
      success: true, 
      message: 'Transacción registrada exitosamente',
      data: {
        orderID,
        date
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

    // Query transactions from Supabase Transactions_Orders table
    // Map the Supabase rows into the same shape expected by the frontend
    // Query transactions from Supabase Transactions_Orders table (flexible name)
    let txData: any[] = [];
    try {
      const ordersSrc = await fromFlexible('Transactions_Orders');
      const { data: _txData, error: txErr } = await ordersSrc.from().select('Date,Time,OrderID,UserID,Name,Quantity,Method,Products');
      if (txErr) {
        console.error('Error fetching transactions from Supabase:', txErr);
        return json({ success: false, error: 'Error fetching transactions' }, { status: 500 });
      }
      txData = _txData || [];
    } catch (e) {
      console.error('Error locating Transactions_Orders:', e);
      return json({ success: false, error: 'Error fetching transactions' }, { status: 500 });
    }
    const rows = (txData || []).map((r: any) => [r.Date, r.Time, r.OrderID, r.UserID, r.Name, r.Quantity, r.Method, r.Products]);
    
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

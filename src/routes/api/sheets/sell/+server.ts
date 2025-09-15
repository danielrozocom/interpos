import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDoc } from '$lib/sheet';
import { SHEET_NAMES } from '$lib/server/config';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, productId, quantity, total } = await request.json();
    
    if (!userId || !productId || !quantity || !total) {
      return json({
        success: false,
        error: 'Faltan datos requeridos'
      }, { status: 400 });
    }

    const doc = await getDoc();
    if (!doc) throw new Error('No se pudo conectar con Google Sheets');

  // Get user sheet
  const userSheet = doc.sheetsByTitle[SHEET_NAMES.users];
    if (!userSheet) throw new Error('No se encontró la hoja de usuarios');

    // Get user data
    const users = await userSheet.getRows();
    const userRow = users.find(row => row.get('id') === userId);
    
    if (!userRow) {
      return json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 });
    }

    const currentBalance = Number(userRow.get('balance')) || 0;
    if (currentBalance < total) {
      return json({
        success: false,
        error: 'Saldo insuficiente'
      }, { status: 400 });
    }

    // Update user balance
    const newBalance = currentBalance - total;
    userRow.set('balance', newBalance);
    await userRow.save();

  // Record transaction in transactions sheet
  const historySheet = doc.sheetsByTitle[SHEET_NAMES.transactions];
  if (!historySheet) throw new Error('No se encontró la hoja de transacciones');

    await historySheet.addRow({
      userId,
      productId,
      quantity,
      amount: -total,
      type: 'purchase',
      date: new Date().toISOString()
    });

    return json({
      success: true,
      newBalance
    });
  } catch (error) {
    console.error('Error processing sale:', error);
    return json({
      success: false,
      error: 'Error al procesar la venta'
    }, { status: 500 });
  }
};

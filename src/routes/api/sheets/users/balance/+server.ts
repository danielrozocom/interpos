import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserBalance } from '$lib/sheet';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      throw error(400, {
        message: 'ID de usuario requerido'
      });
    }

    const balance = await getUserBalance(userId);

    return json({
      success: true,
      balance
    });
  } catch (err) {
    console.error('Error en el endpoint de saldo:', err);
    if (err instanceof Error) {
      return json({
        success: false,
        error: err.message
      }, { status: err.message.includes('no encontrado') ? 404 : 500 });
    }
    return json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
};

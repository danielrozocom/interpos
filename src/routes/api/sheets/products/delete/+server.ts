import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

// POST /api/sheets/products/delete
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { id } = await request.json();

    // Validar que se proporcione el ID
    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID del producto es requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que el producto existe antes de eliminarlo
    const { data: existingProduct, error: checkError } = await sbServer
      .from('Products')
      .select('ID, Name')
      .eq('ID', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') { // No rows returned
        return new Response(JSON.stringify({
          success: false,
          error: 'Producto no encontrado'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('Error checking product existence:', checkError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al verificar producto'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Eliminar el producto
    const { error: deleteError } = await sbServer
      .from('Products')
      .delete()
      .eq('ID', id);

    if (deleteError) {
      console.error('Supabase error deleting product:', deleteError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al eliminar producto de la base de datos'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Producto "${existingProduct.Name}" eliminado correctamente`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en el endpoint de eliminar producto:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
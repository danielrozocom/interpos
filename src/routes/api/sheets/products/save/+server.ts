import type { RequestHandler } from '@sveltejs/kit';
import { sbServer } from '$lib/supabase';

// POST /api/sheets/products/save
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { id, name, price, category } = await request.json();

    // Validar datos requeridos
    if (!id || !name || price === undefined || price === null) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID, nombre y precio son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validar que el precio sea un número válido
    const numericPrice = Number(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'El precio debe ser un número válido mayor o igual a 0'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si el producto ya existe
    const { data: existingProduct, error: checkError } = await sbServer
      .from('Products')
      .select('ID')
      .eq('ID', id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing product:', checkError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al verificar producto existente'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let result;
    if (existingProduct) {
      // Actualizar producto existente
      result = await sbServer
        .from('Products')
        .update({
          Name: name,
          Price: numericPrice.toString(),
          Category: category || ''
        })
        .eq('ID', id);
    } else {
      // Crear nuevo producto
      result = await sbServer
        .from('Products')
        .insert({
          ID: id,
          Name: name,
          Price: numericPrice.toString(),
          Category: category || ''
        });
    }

    if (result.error) {
      console.error('Supabase error saving product:', result.error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al guardar producto en la base de datos'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: existingProduct ? 'Producto actualizado correctamente' : 'Producto creado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en el endpoint de guardar producto:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
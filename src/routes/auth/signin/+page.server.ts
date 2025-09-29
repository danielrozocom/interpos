import type { Actions, RequestEvent } from './$types';
import { sbServer } from '$lib/supabase';

// Helper to find user by email in Supabase (Customers or users table)
async function findUserByEmail(email: string) {
  try {
    const { data, error } = await sbServer.from('users').select('id,name,email,role').eq('email', email).limit(1).maybeSingle();
    if (!error && data) return { name: data.name || '', email: data.email, role: data.role || '' };

    const res2 = await sbServer.from('Customers').select('ID,Name,Email').ilike('Email', email).limit(1).maybeSingle();
    if (!res2.error && res2.data) return { name: res2.data.Name || '', email: res2.data.Email || '', role: '' };

    return null;
  } catch (e) {
    console.error('findUserByEmail error:', e);
    return null;
  }
}

// Simple session encoder: base64 JSON. In production, use signed/encrypted cookies or a session store.
function createSessionCookie(payload: Record<string, any>) {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString('base64');
}

export const actions: Actions = {
  default: async ({ request, cookies }: RequestEvent) => {
    const form = await request.formData();
    const email = String(form.get('email') || '').trim();
    if (!email) {
      return { status: 400, body: { error: 'Email es requerido' } };
    }

    try {
      const user = await findUserByEmail(email);
      if (!user) {
        return { status: 401, body: { error: 'Usuario no autorizado' } };
      }

      const cookie = createSessionCookie({ email: user.email, name: user.name, role: user.role });
      // Set cookie via SvelteKit cookies helper. Secure in production.
      cookies.set('session', cookie, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      });
      return { status: 200, body: { success: true } };
    } catch (err) {
      console.error('Error en signin action:', err);
      return { status: 500, body: { error: 'Error interno' } };
    }
  }
};

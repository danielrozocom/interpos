import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  // Just load the page - the client-side code will handle the hash
  return new Response(null, { status: 200 });
};

// Accept a POST from the client-side implicit callback handler containing the
// access and refresh tokens. We write them as HttpOnly cookies so server-side
// hooks can validate the session on subsequent requests.
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const access_token = body?.access_token;
    const refresh_token = body?.refresh_token;

    if (!access_token || !refresh_token) {
      return new Response(JSON.stringify({ error: 'missing_tokens' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Mirror the same cookie options used in the PKCE callback
    const secure = process.env.NODE_ENV === 'production';
    console.log('[IMPLICIT] Setting cookies for implicit flow');

    cookies.set('sb-access-token', access_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    cookies.set('sb-refresh-token', refresh_token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    console.log('[IMPLICIT] Cookies set successfully');

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Error in implicit-callback POST:', err);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
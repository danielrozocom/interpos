import type { RequestHandler } from './$types';
import { sbServer } from '$lib/supabase';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { access_token } = await request.json();
    if (!access_token) return new Response('Missing token', { status: 400 });

    // Verify token by getting user
    const { data: user, error } = await sbServer.auth.getUser(access_token as string);
    if (error || !user?.user) {
      return new Response('Invalid token', { status: 401 });
    }

    // Set httpOnly cookie with access token (short-lived in dev)
    const cookie = `sb_access_token=${access_token}; Path=/; HttpOnly; SameSite=Lax`;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response('Server error', { status: 500 });
  }
};

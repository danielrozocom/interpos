// src/routes/api/users/+server.ts
import type { RequestHandler } from './$types';
import { getUsers } from '$lib/sheets';

export const GET: RequestHandler = async () => {
  const users = await getUsers();
  return new Response(JSON.stringify(users), {
    headers: { 'Content-Type': 'application/json' }
  });
};

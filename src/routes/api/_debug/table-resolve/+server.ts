import type { RequestHandler } from './$types';
import { findExistingTable } from '$lib/dbHelpers';

export const GET: RequestHandler = async ({ url }) => {
  const base = url.searchParams.get('base') || 'Transactions_Balance';
  try {
    const found = await findExistingTable(base);
    return new Response(JSON.stringify({ success: true, base, found }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

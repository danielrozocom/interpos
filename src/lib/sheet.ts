// src/lib/sheet.ts
// Supabase-backed replacement for previous Google Sheets integration.
import { sbServer } from './supabase';
import { SHEET_NAMES as PUBLIC_SHEET_NAMES } from './config';
import { parseCurrency } from './parseCurrency';

// Get the balance of a user from Supabase 'Customers' or 'users' table.
export async function getUserBalance(userId: string | number): Promise<number> {
	try {
		const id = typeof userId === 'string' ? userId : String(userId);
		// Try Customers table first (legacy naming used in many server routes)
		let res = await sbServer.from('Customers').select('Balance').eq('ID', Number(id)).maybeSingle();
		if (!res.error && res.data) {
		return parseCurrency(res.data.Balance);
		}

		// Fallback to 'users' table (newer naming)
		res = await sbServer.from('users').select('balance').eq('id', id).maybeSingle();
		if (!res.error && res.data) {
			// data shape may differ
			const b = (res.data as any).balance ?? (res.data as any).Balance;
			return parseCurrency(b);
		}

		return 0;
	} catch (e) {
		console.error('getUserBalance error:', e);
		return 0;
	}
}

// Get all users (returns unified shape)
export async function getUsers(): Promise<Array<{ id: string; name: string; balance: number }>> {
	try {
		// Prefer Customers (legacy) table
		const res = await sbServer.from('Customers').select('ID,Name,Balance');
		if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
			return res.data.map((r: any) => ({ id: String(r.ID), name: r.Name || '', balance: parseCurrency(r.Balance) }));
		}

		// Fallback to users table
		const res2 = await sbServer.from('users').select('id,name,balance');
		if (!res2.error && Array.isArray(res2.data)) {
			return res2.data.map((r: any) => ({ id: String(r.id), name: r.name || '', balance: parseCurrency(r.balance) }));
		}

		return [];
	} catch (e) {
		console.error('getUsers error:', e);
		return [];
	}
}

// NOTE: legacy constant `SHEET_NAMES` was used for Google Sheets titles.
// The application now uses Supabase; keep `PUBLIC_SHEET_NAMES` in config for
// any remaining compatibility, but do not re-export it here to avoid
// implying a Sheets integration.
// If any code still needs the old names, import them from '$lib/config'.

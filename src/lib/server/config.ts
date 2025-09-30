// src/lib/server/config.ts
// Configuración del servidor

import { SHEET_NAMES } from '../config';
import dotenv from 'dotenv';
import path from 'path';

// Load environment files so local overrides like SUPABASE_TRANSACTIONS_BALANCE_TABLE are available
try {
	dotenv.config({ path: path.resolve(process.cwd(), '.env') });
	dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch (e) {
	// ignore
}

// Server config - Supabase is used instead of Google Sheets.
// Keep a minimal server config surface so other modules can import sheet names.

// Re-export sheet names for server-side modules to use (backwards compatibility)
export { SHEET_NAMES };

// Optionally export Supabase env var names for server use elsewhere
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_UR || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// Optional: allow forcing exact Supabase table names via env vars
// Example: set SUPABASE_TRANSACTIONS_BALANCE_TABLE=transactions_balance (or the exact table name in your DB)
export const TABLE_NAME_OVERRIDES: Record<string, string | undefined> = {
	// Prefer explicit env override, otherwise default to the confirmed table name
	'Transactions_Balance': process.env.SUPABASE_TRANSACTIONS_BALANCE_TABLE || 'transactions_balance',
	'Transactions - Balance': process.env.SUPABASE_TRANSACTIONS_BALANCE_TABLE || 'transactions_balance',
	'Transactions_Orders': process.env.SUPABASE_TRANSACTIONS_ORDERS_TABLE || 'transactions_orders',
	'Transactions - Orders': process.env.SUPABASE_TRANSACTIONS_ORDERS_TABLE || 'transactions_orders',
};

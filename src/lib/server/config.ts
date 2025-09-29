// src/lib/server/config.ts
// Configuración del servidor

import { SHEET_NAMES } from '../config';

// Server config - Supabase is used instead of Google Sheets.
// Keep a minimal server config surface so other modules can import sheet names.

// Re-export sheet names for server-side modules to use (backwards compatibility)
export { SHEET_NAMES };

// Optionally export Supabase env var names for server use elsewhere
export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.SUPABASE_UR || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

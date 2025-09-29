// google-auth.ts
// Google Sheets integration has been deprecated in favor of Supabase.
// This module keeps a compatibility surface but will throw if used accidentally.
// google-auth.ts
// Google Sheets integration has been deprecated in favor of Supabase.
// This module keeps a compatibility surface but will throw if used accidentally.

export function getGoogleAuth() {
  throw new Error('Google Sheets auth is deprecated. Use Supabase (sbServer) instead.');
}

export const auth = null as any;
export const sheets = null as any;
export const SPREADSHEET_ID = null as any;

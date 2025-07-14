// src/lib/server/config.ts
// Configuración del servidor

import { env } from '$env/dynamic/private';
import { SHEET_NAMES } from '../config';

// Configuración de Google Sheets
export const GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
export const GOOGLE_PRIVATE_KEY = (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
export const GOOGLE_SHEET_ID = env.GOOGLE_SHEET_ID || '';

// Re-exportar los nombres de las hojas para uso en el servidor
export { SHEET_NAMES };

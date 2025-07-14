// src/lib/config.ts
// Configuración pública del sistema

// Constantes públicas
export const siteName = 'InterPOS';

// Nombres de las hojas (solo para tipado en el cliente)
export const SHEET_NAMES = {
  USERS: 'users',
  PRODUCTS: 'products',
  HISTORY: 'history'
} as const;

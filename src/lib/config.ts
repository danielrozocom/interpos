// src/lib/config.ts
// Configuración pública del sistema

// Constantes públicas
export const siteName = 'InterPOS';

// Configuración de nombres de hojas de Google Sheets
export const SHEET_NAMES = {
  orders: 'Orders',
  transactions: 'Transactions',
  users: 'Users'
};

// Función utilitaria para formatear fechas desde ISO 8601 en zona horaria de Colombia
export function formatDate(dateInput: string | Date): string {
  try {
    let date: Date;
    
    // Si es string, intentar parsearlo como ISO 8601
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else {
      date = dateInput;
    }
    
    // Verificar que la fecha sea válida
    if (!date || isNaN(date.getTime())) {
      console.log('Invalid date, using current date');
      date = new Date();
    }
    
    // Convertir a zona horaria de Colombia
    const colombiaOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Etc/GMT+5',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    return date.toLocaleString('es-CO', colombiaOptions);
  } catch (error) {
    console.error('Error formatting date:', error, 'Original:', dateInput);
    return new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }); // Fallback a fecha actual
  }
}

// Función para generar fecha y hora actual en el formato estándar del sistema
export function getCurrentFormattedDate(): string {
  return formatDate(new Date());
}

// Función para generar fecha y hora actual en formato ISO 8601
export function getCurrentISODate(): string {
  return new Date().toISOString();
}

// Función para generar solo la fecha en formato ISO (YYYY-MM-DD)
export function getCurrentISODateOnly(): string {
  return new Date().toISOString().split('T')[0];
}


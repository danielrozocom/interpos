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

// Función utilitaria para formatear fechas con el formato estándar del sistema
// Formato: DD/mmm/YYYY h:mm:ssa.m./p.m.
export function formatDate(dateInput: string | Date): string {
  try {
    let date: Date;
    
    // Si ya viene con "Invalid Date", usar fecha actual
    if (typeof dateInput === 'string' && dateInput.includes('Invalid Date')) {
      date = new Date();
    }
    // Si no hay fecha o está vacía, devolver placeholder
    else if (!dateInput || dateInput === '' || dateInput === 'undefined' || dateInput === 'null') {
      return 'Fecha no disponible';
    }
    // Si ya viene en el formato correcto del sistema, devolverlo tal como está
    else if (typeof dateInput === 'string' && dateInput.includes('/') && (dateInput.includes('a.m.') || dateInput.includes('p.m.'))) {
      return dateInput;
    }
    else if (typeof dateInput === 'string') {
      const cleanDateStr = dateInput.trim();
      
      // Formato colombiano: dd/mm/yyyy, hh:mm:ss o dd/mm/yyyy hh:mm:ss
      if (cleanDateStr.includes('/') && (cleanDateStr.includes(',') || cleanDateStr.includes(' '))) {
        // Separar fecha y hora
        const parts = cleanDateStr.split(/[, ]+/);
        if (parts.length >= 2) {
          const datePart = parts[0]; // dd/mm/yyyy
          const timePart = parts[1]; // hh:mm:ss
          
          // Convertir dd/mm/yyyy a yyyy-mm-dd para que JavaScript lo entienda
          const dateSegments = datePart.split('/');
          if (dateSegments.length === 3) {
            const day = dateSegments[0].padStart(2, '0');
            const month = dateSegments[1].padStart(2, '0');
            const year = dateSegments[2];
            
            // Crear fecha en formato ISO
            const isoString = `${year}-${month}-${day}T${timePart}`;
            date = new Date(isoString);
          } else {
            date = new Date(cleanDateStr);
          }
        } else {
          date = new Date(cleanDateStr);
        }
      }
      // Formato ISO con T
      else if (cleanDateStr.includes('T')) {
        date = new Date(cleanDateStr);
      }
      // Formato general dd/mm/yyyy
      else if (cleanDateStr.includes('/')) {
        const parts = cleanDateStr.split('/');
        if (parts.length === 3) {
          // Asumiendo dd/mm/yyyy
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // JavaScript months are 0-based
          const year = parseInt(parts[2]);
          date = new Date(year, month, day);
        } else {
          date = new Date(cleanDateStr);
        }
      }
      // Otros formatos
      else {
        date = new Date(cleanDateStr);
      }
    } else {
      date = dateInput as Date;
    }
    
    // Si no se pudo parsear, usar fecha actual
    if (!date || isNaN(date.getTime())) {
      console.warn('Cannot parse date, using current date:', dateInput);
      date = new Date();
    }
    
    // Nombres de meses abreviados en español (minúsculas)
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = monthsShort[date.getMonth()];
    const year = date.getFullYear();
    
    // Obtener hora en formato 12 horas
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    
    hours = hours % 12;
    if (hours === 0) hours = 12;
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}${ampm}`;
  } catch (error) {
    // En caso de cualquier error, usar fecha actual
    console.error('Error formatting date:', error, 'Original:', dateInput);
    const now = new Date();
    const monthsShort = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    
    const day = now.getDate().toString().padStart(2, '0');
    const month = monthsShort[now.getMonth()];
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    
    hours = hours % 12;
    if (hours === 0) hours = 12;
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}${ampm}`;
  }
}

// Función para generar fecha y hora actual en el formato estándar del sistema
export function getCurrentFormattedDate(): string {
  return formatDate(new Date());
}

// Función para generar fecha y hora actual en formato ISO para almacenamiento
export function getCurrentISODate(): string {
  return new Date().toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}


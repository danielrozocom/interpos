import { format } from 'date-fns';

/**
 * Formats a date string into a readable format in Colombia timezone.
 * @param dateString - The date string to format (ISO 8601 or Date object).
 * @param formatString - The desired format (default: 'dd/MM/yyyy').
 * @returns The formatted date string in Colombia timezone.
 */
export function formatDate(dateString: string | Date, formatString: string = 'dd/MM/yyyy'): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    // Convert to GMT-5 timezone
    const gmt5Date = new Date(date.toLocaleString("en-US", {timeZone: "Etc/GMT+5"}));
    return format(gmt5Date, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Fecha inválida';
  }
}

/**
 * Formats a date string into readable date only in Colombia timezone.
 * @param dateString - The date string to format (ISO 8601 or Date object).
 * @returns The formatted date string (dd/MM/yyyy) in Colombia timezone.
 */
export function formatDateOnly(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    // Convert to GMT-5 timezone and format as date only
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Etc/GMT+5',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    };
    
    return date.toLocaleDateString('es-CO', options);
  } catch (error) {
    console.error('Error formatting date only:', error);
    return '-';
  }
}

/**
 * Formats a date string into readable time only in Colombia timezone.
 * @param dateString - The date string to format (ISO 8601 or Date object).
 * @returns The formatted time string (HH:mm:ss) in Colombia timezone.
 */
export function formatTimeOnly(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    // Convert to GMT-5 timezone and format as time only
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Etc/GMT+5',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    return date.toLocaleTimeString('es-CO', options);
  } catch (error) {
    console.error('Error formatting time only:', error);
    return '-';
  }
}

/**
 * Gets the current date in the specified timezone as ISO 8601 string.
 * @param timezone - The timezone (default: 'America/Bogota').
 * @returns The current date as an ISO 8601 string.
 */
export function getCurrentDateInTimezone(timezone: string = 'America/Bogota'): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Etc/GMT+5' });
}

/**
 * Gets the current date and time as ISO 8601 string.
 * @returns The current date and time as an ISO 8601 string.
 */
export function getCurrentISODateTime(): string {
  return new Date().toISOString();
}

/**
 * Converts a date to ISO 8601 format in local timezone.
 * @param date - The date to convert.
 * @returns The date as an ISO 8601 string in local timezone.
 */
export function toISOLocal(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 19);
}


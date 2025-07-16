import { format, parseISO } from 'date-fns';

/**
 * Formats a date string into a readable format.
 * @param dateString - The date string to format.
 * @param formatString - The desired format (default: 'dd/MM/yyyy').
 * @returns The formatted date string.
 */
export function formatDate(dateString: string, formatString: string = 'dd/MM/yyyy'): string {
  const date = parseISO(dateString);
  return format(date, formatString);
}

/**
 * Gets the current date in the specified timezone.
 * @param timezone - The timezone (default: 'America/Bogota').
 * @returns The current date as a string in ISO format.
 */
export function getCurrentDateInTimezone(timezone: string = 'America/Bogota'): string {
  const date = new Date().toLocaleString('en-CA', { timeZone: timezone });
  return date.split(' ')[0]; // Extract YYYY-MM-DD
}

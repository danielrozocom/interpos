/**
 * Formats a date string into a readable format.
 * @param dateString - The date string to format.
 * @param formatString - The desired format (default: 'dd/MM/yyyy').
 * @returns The formatted date string.
 */
export declare function formatDate(dateString: string, formatString?: string): string;

/**
 * Gets the current date in the specified timezone.
 * @param timezone - The timezone (default: 'America/Bogota').
 * @returns The current date as a string in ISO format.
 */
export declare function getCurrentDateInTimezone(timezone?: string): string;

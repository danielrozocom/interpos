/**
 * Formats a date string into a readable format in Colombia timezone.
 * @param dateString - The date string to format.
 * @param formatString - The desired format (default: 'dd/MM/yyyy').
 * @returns The formatted date string.
 */
export declare function formatDate(dateString: string | Date, formatString?: string): string;

/**
 * Formats a date string into readable date only in Colombia timezone.
 * @param dateString - The date string to format.
 * @returns The formatted date string (dd/MM/yyyy).
 */
export declare function formatDateOnly(dateString: string | Date): string;

/**
 * Formats a date string into readable time only in Colombia timezone.
 * @param dateString - The date string to format.
 * @returns The formatted time string (HH:mm:ss).
 */
export declare function formatTimeOnly(dateString: string | Date): string;

/**
 * Gets the current date in the specified timezone as ISO 8601 string.
 * @param timezone - The timezone (default: 'America/Bogota').
 * @returns The current date as an ISO 8601 string.
 */
export declare function getCurrentDateInTimezone(timezone?: string): string;

/**
 * Gets the current date and time as ISO 8601 string.
 * @returns The current date and time as an ISO 8601 string.
 */
export declare function getCurrentISODateTime(): string;

/**
 * Converts a date to ISO 8601 format in local timezone.
 * @param date - The date to convert.
 * @returns The date as an ISO 8601 string in local timezone.
 */
export declare function toISOLocal(date?: Date): string;

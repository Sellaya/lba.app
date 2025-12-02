/**
 * Toronto Timezone Utilities
 * All dates and times in the application should use Toronto time (America/Toronto)
 * This ensures consistency regardless of where the server or user is located.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { format, parse, differenceInDays, isPast, isFuture, formatDistanceToNow, parseISO } from 'date-fns';

// Toronto timezone constant
export const TORONTO_TIMEZONE = 'America/Toronto';

/**
 * Get current date/time in Toronto timezone
 */
export function getTorontoNow(): Date {
  // Get current UTC time and convert to Toronto timezone
  const now = new Date();
  return toZonedTime(now, TORONTO_TIMEZONE);
}

/**
 * Convert a date to Toronto timezone
 */
export function toTorontoTime(date: Date | string | number): Date {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;
  return toZonedTime(dateObj, TORONTO_TIMEZONE);
}

/**
 * Convert a Toronto timezone date to UTC
 */
export function fromTorontoTime(date: Date): Date {
  return fromZonedTime(date, TORONTO_TIMEZONE);
}

/**
 * Format a date in Toronto timezone
 * This is a drop-in replacement for date-fns format() that ensures Toronto timezone
 */
export function formatToronto(date: Date | string | number, formatStr: string): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' 
    ? new Date(date) 
    : date;
  return formatInTimeZone(dateObj, TORONTO_TIMEZONE, formatStr);
}

/**
 * Parse a date string and interpret it as Toronto time
 * @throws Error if date string is invalid
 */
export function parseToronto(dateString: string, formatStr: string, referenceDate?: Date): Date {
  if (!dateString || typeof dateString !== 'string') {
    throw new Error(`Invalid date string: expected string, got ${typeof dateString}`);
  }
  const parsed = parse(dateString, formatStr, referenceDate || getTorontoNow());
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date string: "${dateString}" with format "${formatStr}"`);
  }
  // Convert to Toronto timezone
  return toZonedTime(parsed, TORONTO_TIMEZONE);
}

/**
 * Get today's date in Toronto timezone (midnight)
 */
export function getTorontoToday(): Date {
  const now = getTorontoNow();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Format date for display (uses Toronto timezone)
 * Drop-in replacement for date-fns format() with Toronto timezone
 */
export function formatDate(date: Date | string | number, formatStr: string): string {
  return formatToronto(date, formatStr);
}

/**
 * Calculate difference in days using Toronto timezone
 */
export function differenceInDaysToronto(dateLeft: Date | string, dateRight: Date | string): number {
  const left = typeof dateLeft === 'string' ? parseISO(dateLeft) : new Date(dateLeft);
  const right = typeof dateRight === 'string' ? parseISO(dateRight) : new Date(dateRight);
  const leftToronto = toTorontoTime(left);
  const rightToronto = toTorontoTime(right);
  // Reset to midnight for accurate day difference
  leftToronto.setHours(0, 0, 0, 0);
  rightToronto.setHours(0, 0, 0, 0);
  return differenceInDays(leftToronto, rightToronto);
}

/**
 * Check if date is in the past (using Toronto timezone)
 */
export function isPastToronto(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const torontoDate = toTorontoTime(dateObj);
  const torontoNow = getTorontoNow();
  return torontoDate < torontoNow;
}

/**
 * Check if date is in the future (using Toronto timezone)
 */
export function isFutureToronto(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const torontoDate = toTorontoTime(dateObj);
  const torontoNow = getTorontoNow();
  return torontoDate > torontoNow;
}

/**
 * Format distance to now in Toronto timezone
 */
export function formatDistanceToNowToronto(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const torontoDate = toTorontoTime(dateObj);
  const torontoNow = getTorontoNow();
  return formatDistanceToNow(torontoDate, { addSuffix: true });
}

/**
 * Create a date from year, month, day in Toronto timezone
 * This creates a date that represents the given local time in Toronto, then converts to UTC
 */
export function createTorontoDate(year: number, month: number, day: number, hours: number = 0, minutes: number = 0, seconds: number = 0): Date {
  // Create date string in ISO format (this will be interpreted as local time)
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  // Parse as if it's a local date, then convert from Toronto timezone to UTC
  const localDate = new Date(dateStr);
  // Convert from Toronto timezone to UTC
  return fromZonedTime(localDate, TORONTO_TIMEZONE);
}

/**
 * Set hours/minutes/seconds on a date in Toronto timezone
 */
export function setTorontoTime(date: Date, hours: number, minutes: number = 0, seconds: number = 0, milliseconds: number = 0): Date {
  const torontoDate = toTorontoTime(date);
  torontoDate.setHours(hours, minutes, seconds, milliseconds);
  return fromTorontoTime(torontoDate);
}


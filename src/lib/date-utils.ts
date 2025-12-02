/**
 * Centralized date parsing utilities
 * Consolidates duplicate date parsing logic across the codebase
 */

import { parseToronto, getTorontoNow } from './toronto-time';
import type { Day } from './types';

/**
 * Parse an event date from various formats (string, Date object, or undefined)
 * Returns null if date cannot be parsed
 */
export function parseEventDate(date: string | Date | undefined): Date | null {
  if (!date) {
    return null;
  }

  if (typeof date === 'string') {
    try {
      return parseToronto(date, 'PPP');
    } catch (error) {
      console.error('Failed to parse date string:', date, error);
      return null;
    }
  }

  if (date && typeof date === 'object' && 'getTime' in date) {
    const parsedDate = new Date(date as Date);
    if (isNaN(parsedDate.getTime())) {
      console.error('Invalid date object:', date);
      return null;
    }
    return parsedDate;
  }

  return null;
}

/**
 * Parse time string in various formats (e.g., "10:00 AM", "10:00", "10:00:00")
 * Returns hours and minutes, defaults to 10:00 if parsing fails
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const trimmed = timeStr.trim();
  let hours = 10;
  let minutes = 0;

  // Handle AM/PM format: "10:00 AM" or "10:00 PM"
  if (trimmed.includes('AM') || trimmed.includes('PM')) {
    const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (timeMatch[3].toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
      return { hours, minutes };
    }
  }

  // Handle 24-hour format: "10:00" or "10:00:00"
  const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    return { hours, minutes };
  }

  // Default to 10:00 if parsing fails
  return { hours: 10, minutes: 0 };
}

/**
 * Get the first event date from a booking's days array
 * Returns null if no valid date is found
 */
export function getFirstEventDate(days: Day[] | undefined): Date | null {
  if (!days || days.length === 0) {
    return null;
  }

  const firstDay = days[0];
  if (!firstDay || !firstDay.date) {
    return null;
  }

  return parseEventDate(firstDay.date);
}

/**
 * Validate that a booking day has all required fields for event scheduling
 * Note: location is stored in the booking, not the day
 */
export function validateBookingDayForEvent(day: Day | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!day) {
    return { valid: false, error: 'Booking day is missing' };
  }

  if (!day.date) {
    return { valid: false, error: 'Booking day is missing date' };
  }

  if (!day.getReadyTime) {
    return { valid: false, error: 'Booking day is missing getReadyTime' };
  }

  return { valid: true };
}


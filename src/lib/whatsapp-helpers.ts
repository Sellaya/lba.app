/**
 * Centralized WhatsApp reminder scheduling helpers
 * Consolidates duplicate scheduling logic across the codebase
 */

import type { FinalQuote } from './types';
import { scheduleReminder2WWhatsApp, scheduleReminder1WWhatsApp } from './whatsapp';

/**
 * Type for a WhatsApp reminder (2-week or 1-week)
 */
type WhatsAppReminder = NonNullable<FinalQuote['whatsappMessages']>['reminder2w'] | NonNullable<FinalQuote['whatsappMessages']>['reminder1w'];

/**
 * Check if a reminder needs to be scheduled
 */
function shouldScheduleReminder(
  reminder: WhatsAppReminder | undefined
): boolean {
  if (!reminder) {
    return true; // Doesn't exist, should schedule
  }

  // If it was successfully sent, don't re-schedule
  const wasSuccessfullySent = reminder.sent && reminder.sentAt && !reminder.error;
  if (wasSuccessfullySent) {
    return false;
  }

  // Schedule if:
  // - Not scheduled yet (no scheduledFor date), OR
  // - Was previously skipped due to timing (error contains 'days away')
  const needsScheduling = !reminder.scheduledFor || 
    !!(reminder.error && reminder.error.includes('days away'));

  return needsScheduling;
}

/**
 * Ensure WhatsApp reminders are scheduled for a booking
 * This is idempotent - it won't re-schedule if already scheduled/sent
 */
export async function ensureWhatsAppRemindersScheduled(quote: FinalQuote): Promise<{
  scheduled2w: boolean;
  scheduled1w: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let scheduled2w = false;
  let scheduled1w = false;

  try {
    // Check if 2-week reminder needs scheduling
    const reminder2w = quote.whatsappMessages?.reminder2w;
    if (shouldScheduleReminder(reminder2w)) {
      try {
        await scheduleReminder2WWhatsApp(quote);
        scheduled2w = true;
      } catch (error: any) {
        errors.push(`2-week reminder: ${error.message}`);
      }
    }

    // Check if 1-week reminder needs scheduling
    const reminder1w = quote.whatsappMessages?.reminder1w;
    if (shouldScheduleReminder(reminder1w)) {
      try {
        await scheduleReminder1WWhatsApp(quote);
        scheduled1w = true;
      } catch (error: any) {
        errors.push(`1-week reminder: ${error.message}`);
      }
    }
  } catch (error: any) {
    errors.push(`General error: ${error.message}`);
  }

  return { scheduled2w, scheduled1w, errors };
}


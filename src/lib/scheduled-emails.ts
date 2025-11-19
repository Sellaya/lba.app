'use server';

import { supabaseAdmin } from './supabase/server';
import type { FinalQuote } from './types';

export type ScheduledEmailType = 'followup-3h' | 'followup-6h' | 'followup-24h' | 'followup-3d' | 'followup-6d' | 'followup-30d' | 'event-reminder-24h' | 'appointment-day-reminder';

export interface ScheduledEmail {
  id?: string;
  booking_id: string;
  email_type: ScheduledEmailType;
  scheduled_for: string; // ISO timestamp
  sent: boolean;
  sent_at?: string;
  created_at?: string;
}

/**
 * Schedule follow-up emails for a quote
 * Only schedules if:
 * - Status is 'quoted' (not confirmed)
 * - Advance payment has NOT been made (no paymentDetails or status is not 'deposit-paid' or 'payment-approved')
 * 
 * @param quote - The quote/booking to schedule emails for
 * @param bookingCreatedAt - Optional: The booking creation timestamp. If provided, emails are scheduled relative to this time. If not provided, uses current time.
 */
export async function scheduleFollowUpEmails(quote: FinalQuote, bookingCreatedAt?: Date | string): Promise<void> {
  // Don't schedule follow-up emails if booking is confirmed
  if (quote.status === 'confirmed') {
    console.log(`Skipping follow-up email scheduling for confirmed booking ${quote.id}`);
    return;
  }

  // Don't schedule follow-up emails if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`Skipping follow-up email scheduling for booking ${quote.id} - advance payment already made`);
    return;
  }

  // Use booking creation time if provided, otherwise use current time
  const baseTime = bookingCreatedAt 
    ? (typeof bookingCreatedAt === 'string' ? new Date(bookingCreatedAt) : bookingCreatedAt)
    : new Date();
  const bookingId = quote.id;
  const now = new Date();

  // Schedule all follow-up emails relative to base time
  // TESTING: Changed from 3 hours to 5 minutes for testing
  const scheduled3H = new Date(baseTime.getTime() + 5 * 60 * 1000); // 5 minutes (TESTING - change back to 3 * 60 * 60 * 1000)
  const scheduled6H = new Date(baseTime.getTime() + 6 * 60 * 60 * 1000); // 6 hours
  const scheduled24H = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const scheduled3D = new Date(baseTime.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
  const scheduled6D = new Date(baseTime.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days
  const scheduled30D = new Date(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Schedule all follow-up emails relative to booking creation time
  // We schedule ALL emails regardless of whether they're in the past or future
  // This ensures the UI can display them, and the processing endpoint will handle them appropriately
  const scheduledEmails: Omit<ScheduledEmail, 'id' | 'created_at'>[] = [
    {
      booking_id: bookingId,
      email_type: 'followup-3h',
      scheduled_for: scheduled3H.toISOString(),
      sent: false,
    },
    {
      booking_id: bookingId,
      email_type: 'followup-6h',
      scheduled_for: scheduled6H.toISOString(),
      sent: false,
    },
    {
      booking_id: bookingId,
      email_type: 'followup-24h',
      scheduled_for: scheduled24H.toISOString(),
      sent: false,
    },
    {
      booking_id: bookingId,
      email_type: 'followup-3d',
      scheduled_for: scheduled3D.toISOString(),
      sent: false,
    },
    {
      booking_id: bookingId,
      email_type: 'followup-6d',
      scheduled_for: scheduled6D.toISOString(),
      sent: false,
    },
    {
      booking_id: bookingId,
      email_type: 'followup-30d',
      scheduled_for: scheduled30D.toISOString(),
      sent: false,
    },
  ];

  // Insert scheduled emails into database
  // First, check if emails already exist for this booking to avoid duplicates
  try {
    // Check for existing scheduled emails for this booking
    const { data: existingEmails, error: fetchError } = await supabaseAdmin
      .from('scheduled_emails')
      .select('email_type')
      .eq('booking_id', bookingId);

    if (fetchError) {
      // If table doesn't exist, log error with details
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        console.error(`[SCHEDULING ERROR] scheduled_emails table does not exist for booking ${bookingId}. Please create the table in Supabase.`);
        console.error('Error details:', fetchError);
        return;
      }
      console.error(`[SCHEDULING ERROR] Error checking existing scheduled emails for booking ${bookingId}:`, fetchError);
      return;
    }

    // Filter out emails that already exist
    const existingTypes = new Set((existingEmails || []).map((e: any) => e.email_type));
    const emailsToInsert = scheduledEmails.filter(
      (email) => !existingTypes.has(email.email_type)
    );

    if (emailsToInsert.length === 0) {
      console.log(`[SCHEDULING] All follow-up emails already scheduled for booking ${bookingId}`);
      return;
    }

    // Insert only new emails
    const { error: insertError, data: insertedData } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(emailsToInsert)
      .select();

    if (insertError) {
      console.error(`[SCHEDULING ERROR] Error inserting scheduled emails for booking ${bookingId}:`, insertError);
      // Check if it's a duplicate key error (shouldn't happen now, but just in case)
      if (insertError.code === '23505') {
        console.warn(`[SCHEDULING] Duplicate email entries detected for booking ${bookingId}, skipping...`);
      } else {
        console.error(`[SCHEDULING ERROR] Failed to schedule emails. Error code: ${insertError.code}, Message: ${insertError.message}`);
      }
    } else {
      console.log(`[SCHEDULING SUCCESS] Scheduled ${emailsToInsert.length} new follow-up emails for booking ${bookingId} (${existingTypes.size} already existed)`);
      if (insertedData) {
        console.log(`[SCHEDULING] Inserted email IDs:`, insertedData.map((e: any) => ({ id: e.id, type: e.email_type, scheduled_for: e.scheduled_for })));
      }
    }
  } catch (e: any) {
    console.error(`[SCHEDULING ERROR] Unexpected error scheduling emails for booking ${bookingId}:`, e.message);
    console.error('Error stack:', e.stack);
    // Don't throw - scheduling emails shouldn't break quote generation
  }
}

/**
 * Get scheduled emails that are due to be sent
 */
export async function getDueScheduledEmails(): Promise<ScheduledEmail[]> {
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('scheduled_emails')
      .select('*')
      .eq('sent', false)
      .lte('scheduled_for', now);

    if (error) {
      console.error('Error fetching due scheduled emails:', error);
      return [];
    }

    return data || [];
  } catch (e: any) {
    console.error('Error in getDueScheduledEmails:', e.message);
    return [];
  }
}

/**
 * Mark a scheduled email as sent
 */
export async function markScheduledEmailAsSent(scheduledEmailId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
      })
      .eq('id', scheduledEmailId);

    if (error) {
      console.error('Error marking scheduled email as sent:', error);
    }
  } catch (e: any) {
    console.error('Error in markScheduledEmailAsSent:', e.message);
  }
}

/**
 * Schedule event reminder email 24 hours before the event
 * Only schedules if booking is confirmed and payment has been made
 */
export async function scheduleEventReminder24HEmail(quote: FinalQuote): Promise<void> {
  // Only schedule for confirmed bookings with payment
  if (quote.status !== 'confirmed') {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} is not confirmed`);
    return;
  }

  // Only schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (!hasAdvancePayment) {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has no advance payment`);
    return;
  }

  // Get the first event date
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    const { parse } = await import('date-fns');
    const parsedDate = parse(firstDay.date, 'PPP', new Date());
    eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
  } else {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has invalid date format`);
    return;
  }

  // Schedule email 24 hours before the event
  const reminderTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  
  // Don't schedule if the reminder time is in the past
  if (reminderTime < new Date()) {
    console.log(`Skipping event reminder email scheduling - reminder time is in the past for booking ${quote.id}`);
    return;
  }

  const scheduledEmail: Omit<ScheduledEmail, 'id' | 'created_at'> = {
    booking_id: quote.id,
    email_type: 'event-reminder-24h',
    scheduled_for: reminderTime.toISOString(),
    sent: false,
  };

  try {
    // Check if this email type already exists for this booking
    const { data: existingEmails, error: fetchError } = await supabaseAdmin
      .from('scheduled_emails')
      .select('email_type')
      .eq('booking_id', quote.id)
      .eq('email_type', 'event-reminder-24h');

    if (fetchError) {
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        console.error(`[SCHEDULING ERROR] scheduled_emails table does not exist for booking ${quote.id}`);
        return;
      }
      console.error(`[SCHEDULING ERROR] Error checking existing event reminder email for booking ${quote.id}:`, fetchError);
      return;
    }

    if (existingEmails && existingEmails.length > 0) {
      console.log(`[SCHEDULING] Event reminder email already scheduled for booking ${quote.id}`);
      return;
    }

    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmail);

    if (error) {
      if (error.code === '23505') {
        console.warn(`[SCHEDULING] Duplicate event reminder email detected for booking ${quote.id}, skipping...`);
      } else {
        console.error(`[SCHEDULING ERROR] Error scheduling event reminder email for booking ${quote.id}:`, error);
      }
    } else {
      console.log(`[SCHEDULING SUCCESS] Scheduled event reminder email for booking ${quote.id} at ${reminderTime.toISOString()}`);
    }
  } catch (e: any) {
    console.error(`[SCHEDULING ERROR] Unexpected error scheduling event reminder email for booking ${quote.id}:`, e.message);
  }
}

/**
 * Schedule appointment day reminder email 2.5 hours before the appointment time
 * Only schedules if booking is confirmed and advance payment has been made
 */
export async function scheduleAppointmentDayReminderEmail(quote: FinalQuote): Promise<void> {
  // Only schedule for confirmed bookings with payment
  if (quote.status !== 'confirmed') {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} is not confirmed`);
    return;
  }

  // Only schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (!hasAdvancePayment) {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has no advance payment`);
    return;
  }

  // Get the first event date and time
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    const { parse } = await import('date-fns');
    const parsedDate = parse(firstDay.date, 'PPP', new Date());
    eventDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
  } else {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has invalid date format`);
    return;
  }

  // Parse the appointment time (format: "HH:MM")
  const timeString = firstDay.getReadyTime || '10:00';
  const [hours, minutes] = timeString.split(':').map(Number);
  
  // Set the appointment date and time
  const appointmentDateTime = new Date(eventDate);
  appointmentDateTime.setHours(hours || 10, minutes || 0, 0, 0);

  // Schedule email 2.5 hours before the appointment time
  const reminderTime = new Date(appointmentDateTime.getTime() - 2.5 * 60 * 60 * 1000);
  
  // Don't schedule if the reminder time is in the past
  if (reminderTime < new Date()) {
    console.log(`Skipping appointment day reminder email scheduling - reminder time is in the past for booking ${quote.id}`);
    return;
  }

  const scheduledEmail: Omit<ScheduledEmail, 'id' | 'created_at'> = {
    booking_id: quote.id,
    email_type: 'appointment-day-reminder',
    scheduled_for: reminderTime.toISOString(),
    sent: false,
  };

  try {
    // Check if this email type already exists for this booking
    const { data: existingEmails, error: fetchError } = await supabaseAdmin
      .from('scheduled_emails')
      .select('email_type')
      .eq('booking_id', quote.id)
      .eq('email_type', 'appointment-day-reminder');

    if (fetchError) {
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        console.error(`[SCHEDULING ERROR] scheduled_emails table does not exist for booking ${quote.id}`);
        return;
      }
      console.error(`[SCHEDULING ERROR] Error checking existing appointment day reminder email for booking ${quote.id}:`, fetchError);
      return;
    }

    if (existingEmails && existingEmails.length > 0) {
      console.log(`[SCHEDULING] Appointment day reminder email already scheduled for booking ${quote.id}`);
      return;
    }

    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmail);

    if (error) {
      if (error.code === '23505') {
        console.warn(`[SCHEDULING] Duplicate appointment day reminder email detected for booking ${quote.id}, skipping...`);
      } else {
        console.error(`[SCHEDULING ERROR] Error scheduling appointment day reminder email for booking ${quote.id}:`, error);
      }
    } else {
      console.log(`[SCHEDULING SUCCESS] Scheduled appointment day reminder email for booking ${quote.id} at ${reminderTime.toISOString()}`);
    }
  } catch (e: any) {
    console.error(`[SCHEDULING ERROR] Unexpected error scheduling appointment day reminder email for booking ${quote.id}:`, e.message);
  }
}



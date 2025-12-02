'use server';

import { supabaseAdmin } from './supabase/server';
import type { FinalQuote } from './types';
import { getTorontoNow, parseToronto } from './toronto-time';

export type ScheduledEmailType = 'followup-3h' | 'followup-6h' | 'followup-24h' | 'followup-3d' | 'followup-6d' | 'followup-30d' | 'event-reminder-24h' | 'appointment-day-reminder' | 'post-appointment-followup';

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

  // Don't schedule follow-up emails if booking is cancelled
  if (quote.status === 'cancelled') {
    console.log(`Skipping follow-up email scheduling for cancelled booking ${quote.id}`);
    return;
  }

  // Don't schedule follow-up emails if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`Skipping follow-up email scheduling for booking ${quote.id} - advance payment already made`);
    return;
  }

  // Use booking creation time if provided, otherwise use current time in Toronto
  const baseTime = bookingCreatedAt 
    ? (typeof bookingCreatedAt === 'string' ? new Date(bookingCreatedAt) : bookingCreatedAt)
    : getTorontoNow();
  const bookingId = quote.id;
  const now = getTorontoNow();

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
  const now = getTorontoNow().toISOString();

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
        sent_at: getTorontoNow().toISOString(),
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
 * Mark multiple scheduled emails as sent in batch (optimized for performance)
 */
export async function markScheduledEmailsAsSentBatch(scheduledEmailIds: string[]): Promise<void> {
  if (!scheduledEmailIds || scheduledEmailIds.length === 0) {
    return;
  }

  try {
    const sentAt = getTorontoNow().toISOString();
    
    // Update all emails in batch
    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .update({
        sent: true,
        sent_at: sentAt,
      })
      .in('id', scheduledEmailIds);

    if (error) {
      console.error('Error batch marking scheduled emails as sent:', error);
      throw error;
    }
    
    console.log(`Successfully marked ${scheduledEmailIds.length} emails as sent in batch`);
  } catch (e: any) {
    console.error('Error in markScheduledEmailsAsSentBatch:', e.message);
    throw e;
  }
}

/**
 * Schedule event reminder email 24 hours before the event
 * Only schedules if booking is confirmed and payment has been made
 */
export async function scheduleEventReminder24HEmail(quote: FinalQuote): Promise<void> {
  // Don't schedule for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} is cancelled`);
    return;
  }

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
  if (!quote.booking.days || quote.booking.days.length === 0) {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has no booking days`);
    return;
  }
  
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    try {
      const parsedDate = parseToronto(firstDay.date, 'PPP');
      eventDate = parsedDate;
    } catch (error) {
      console.error(`Invalid date format for booking ${quote.id}: ${firstDay.date}`, error);
      return; // Don't schedule if date is invalid
    }
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
    if (isNaN(eventDate.getTime())) {
      console.error(`Invalid date object for booking ${quote.id}`);
      return;
    }
  } else {
    console.log(`Skipping event reminder email scheduling - booking ${quote.id} has invalid date format`);
    return;
  }

  // Schedule email 24 hours before the event
  const reminderTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  
  // Don't schedule if the reminder time is in the past (using Toronto time)
  if (reminderTime < getTorontoNow()) {
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
  // Don't schedule for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} is cancelled`);
    return;
  }

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
  if (!quote.booking.days || quote.booking.days.length === 0) {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has no booking days`);
    return;
  }
  
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    try {
      const parsedDate = parseToronto(firstDay.date, 'PPP');
      eventDate = parsedDate;
    } catch (error) {
      console.error(`Invalid date format for booking ${quote.id}: ${firstDay.date}`, error);
      return; // Don't schedule if date is invalid
    }
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
    if (isNaN(eventDate.getTime())) {
      console.error(`Invalid date object for booking ${quote.id}`);
      return;
    }
  } else {
    console.log(`Skipping appointment day reminder email scheduling - booking ${quote.id} has invalid date format`);
    return;
  }

  // Parse the appointment time (handles both "HH:MM" and "10:00 AM/PM" formats)
  const timeStr = (firstDay.getReadyTime || '10:00').trim();
  let hours = 10;
  let minutes = 0;

  // Handle different time formats
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    // Format: "10:00 AM" or "10:00 PM"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (timeMatch[3].toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  } else {
    // Format: "10:00" or "10:00:00" (24-hour)
    const timeParts = timeStr.split(':').map(Number);
    hours = timeParts[0] || 10;
    minutes = timeParts[1] || 0;
  }

  // Validate hours and minutes
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error(`Invalid time format for booking ${quote.id}: ${timeStr}`);
    hours = 10;
    minutes = 0;
  }
  
  // Set the appointment date and time
  const appointmentDateTime = new Date(eventDate);
  appointmentDateTime.setHours(hours, minutes, 0, 0);

  // Schedule email 2.5 hours before the appointment time
  const reminderTime = new Date(appointmentDateTime.getTime() - 2.5 * 60 * 60 * 1000);
  
  // Check if event date is today (same day as payment approval) - using Toronto time
  const { getTorontoToday } = await import('./toronto-time');
  const today = getTorontoToday();
  const eventDateOnly = new Date(eventDate);
  eventDateOnly.setHours(0, 0, 0, 0);
  const isToday = eventDateOnly.getTime() === today.getTime();
  
  // If the event is today and reminder time is in the past (or very soon within 5 minutes),
  // send the email immediately instead of scheduling
  const { getTorontoNow } = await import('./toronto-time');
  if (isToday && reminderTime <= new Date(getTorontoNow().getTime() + 5 * 60 * 1000)) {
    console.log(`[SCHEDULING] Event date is today for booking ${quote.id} - sending appointment day reminder email immediately`);
    try {
      const { sendAppointmentDayReminderEmail } = await import('@/lib/email');
      await sendAppointmentDayReminderEmail(quote);
      
      // Mark as sent in the database
      const sentEmail: Omit<ScheduledEmail, 'id' | 'created_at'> = {
        booking_id: quote.id,
        email_type: 'appointment-day-reminder',
        scheduled_for: getTorontoNow().toISOString(),
        sent: true,
        sent_at: getTorontoNow().toISOString(),
      };
      
      const { error: insertError } = await supabaseAdmin
        .from('scheduled_emails')
        .insert(sentEmail);
      
      if (insertError && insertError.code !== '23505') {
        console.error(`[SCHEDULING ERROR] Error marking appointment day reminder as sent for booking ${quote.id}:`, insertError);
      } else {
        console.log(`[SCHEDULING SUCCESS] Appointment day reminder email sent immediately for booking ${quote.id}`);
      }
      return;
    } catch (sendError: any) {
      console.error(`[SCHEDULING ERROR] Error sending appointment day reminder email immediately for booking ${quote.id}:`, sendError.message);
      // Continue to schedule it normally as fallback
    }
  }
  
  // Don't schedule if the reminder time is in the past (and it's not today) - using Toronto time
  if (reminderTime < getTorontoNow() && !isToday) {
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

/**
 * Schedule post-appointment follow-up email 6 hours after the appointment time
 * Only schedules if booking is confirmed and advance payment has been made
 */
export async function schedulePostAppointmentFollowupEmail(quote: FinalQuote): Promise<void> {
  // Don't schedule for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`Skipping post-appointment follow-up email scheduling - booking ${quote.id} is cancelled`);
    return;
  }

  // Only schedule for confirmed bookings with payment
  if (quote.status !== 'confirmed') {
    console.log(`Skipping post-appointment follow-up email scheduling - booking ${quote.id} is not confirmed`);
    return;
  }

  // Only schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (!hasAdvancePayment) {
    console.log(`Skipping post-appointment follow-up email scheduling - booking ${quote.id} has no advance payment`);
    return;
  }

  // Get the first event date and time
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`Skipping post-appointment follow-up email scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  if (typeof firstDay.date === 'string') {
    try {
      const parsedDate = parseToronto(firstDay.date, 'PPP');
      eventDate = parsedDate;
    } catch (error) {
      console.error(`Invalid date format for booking ${quote.id}: ${firstDay.date}`, error);
      return; // Don't schedule if date is invalid
    }
  } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
    eventDate = new Date(firstDay.date as Date);
    if (isNaN(eventDate.getTime())) {
      console.error(`Invalid date object for booking ${quote.id}`);
      return;
    }
  } else {
    console.log(`Skipping post-appointment follow-up email scheduling - booking ${quote.id} has invalid date format`);
    return;
  }

  // Parse the appointment time (handles both "HH:MM" and "10:00 AM/PM" formats)
  const timeStr = (firstDay.getReadyTime || '10:00').trim();
  let hours = 10;
  let minutes = 0;

  // Handle different time formats
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    // Format: "10:00 AM" or "10:00 PM"
    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (timeMatch[3].toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  } else {
    // Format: "10:00" or "10:00:00" (24-hour)
    const timeParts = timeStr.split(':').map(Number);
    hours = timeParts[0] || 10;
    minutes = timeParts[1] || 0;
  }

  // Validate hours and minutes
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    console.error(`Invalid time format for booking ${quote.id}: ${timeStr}`);
    hours = 10;
    minutes = 0;
  }
  
  // Set the appointment date and time
  const appointmentDateTime = new Date(eventDate);
  appointmentDateTime.setHours(hours, minutes, 0, 0);

  // Schedule email 6 hours after the appointment time
  const followupTime = new Date(appointmentDateTime.getTime() + 6 * 60 * 60 * 1000);
  
  // Check if appointment has already passed - using Toronto time
  const today = getTorontoNow();
  const appointmentHasPassed = appointmentDateTime < today;
  
  // If appointment has passed and follow-up time is in the past (or very soon within 5 minutes),
  // send the email immediately instead of scheduling
  if (appointmentHasPassed && followupTime <= new Date(getTorontoNow().getTime() + 5 * 60 * 1000)) {
    console.log(`[SCHEDULING] Appointment has passed for booking ${quote.id} - sending post-appointment follow-up email immediately`);
    try {
      const { sendPostAppointmentFollowupEmail } = await import('@/lib/email');
      await sendPostAppointmentFollowupEmail(quote);
      
      // Mark as sent in the database
      const sentEmail: Omit<ScheduledEmail, 'id' | 'created_at'> = {
        booking_id: quote.id,
        email_type: 'post-appointment-followup',
        scheduled_for: getTorontoNow().toISOString(),
        sent: true,
        sent_at: getTorontoNow().toISOString(),
      };
      
      const { error: insertError } = await supabaseAdmin
        .from('scheduled_emails')
        .insert(sentEmail);
      
      if (insertError && insertError.code !== '23505') {
        console.error(`[SCHEDULING ERROR] Error marking post-appointment follow-up as sent for booking ${quote.id}:`, insertError);
      } else {
        console.log(`[SCHEDULING SUCCESS] Post-appointment follow-up email sent immediately for booking ${quote.id}`);
      }
      return;
    } catch (sendError: any) {
      console.error(`[SCHEDULING ERROR] Error sending post-appointment follow-up email immediately for booking ${quote.id}:`, sendError.message);
      // Continue to schedule it normally as fallback
    }
  }
  
  // Don't schedule if the follow-up time is in the past (and appointment hasn't passed yet)
  if (followupTime < new Date() && !appointmentHasPassed) {
    console.log(`Skipping post-appointment follow-up email scheduling - follow-up time is in the past for booking ${quote.id}`);
    return;
  }

  const scheduledEmail: Omit<ScheduledEmail, 'id' | 'created_at'> = {
    booking_id: quote.id,
    email_type: 'post-appointment-followup',
    scheduled_for: followupTime.toISOString(),
    sent: false,
  };

  try {
    // Check if this email type already exists for this booking
    const { data: existingEmails, error: fetchError } = await supabaseAdmin
      .from('scheduled_emails')
      .select('email_type')
      .eq('booking_id', quote.id)
      .eq('email_type', 'post-appointment-followup');

    if (fetchError) {
      if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
        console.error(`[SCHEDULING ERROR] scheduled_emails table does not exist for booking ${quote.id}`);
        return;
      }
      console.error(`[SCHEDULING ERROR] Error checking existing post-appointment follow-up email for booking ${quote.id}:`, fetchError);
      return;
    }

    if (existingEmails && existingEmails.length > 0) {
      console.log(`[SCHEDULING] Post-appointment follow-up email already scheduled for booking ${quote.id}`);
      return;
    }

    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmail);

    if (error) {
      if (error.code === '23505') {
        console.warn(`[SCHEDULING] Duplicate post-appointment follow-up email detected for booking ${quote.id}, skipping...`);
      } else {
        console.error(`[SCHEDULING ERROR] Error scheduling post-appointment follow-up email for booking ${quote.id}:`, error);
      }
    } else {
      console.log(`[SCHEDULING SUCCESS] Scheduled post-appointment follow-up email for booking ${quote.id} at ${followupTime.toISOString()}`);
    }
  } catch (e: any) {
    console.error(`[SCHEDULING ERROR] Unexpected error scheduling post-appointment follow-up email for booking ${quote.id}:`, e.message);
  }
}



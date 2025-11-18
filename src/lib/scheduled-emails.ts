'use server';

import { supabaseAdmin } from './supabase/server';
import type { FinalQuote } from './types';

export type ScheduledEmailType = 'followup-3h' | 'followup-6h' | 'followup-24h' | 'followup-3d' | 'followup-6d' | 'followup-30d' | 'event-reminder-24h';

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
 */
export async function scheduleFollowUpEmails(quote: FinalQuote): Promise<void> {
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

  // Use Toronto timezone for all scheduling
  const now = new Date();
  const bookingId = quote.id;

  // Schedule all follow-up emails
  const scheduled3H = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours
  const scheduled6H = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
  const scheduled24H = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const scheduled3D = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
  const scheduled6D = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000); // 6 days
  const scheduled30D = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

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
  // Note: We'll create a scheduled_emails table in Supabase
  // For now, we'll use a simple approach with the bookings table metadata
  // or create a separate table
  
  try {
    // Check if scheduled_emails table exists, if not, we'll handle it gracefully
    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmails);

    if (error) {
      // If table doesn't exist, log and continue (we'll create it separately)
      console.warn('Could not schedule emails (table may not exist):', error.message);
      console.log('Scheduled emails would be:', scheduledEmails);
    } else {
      console.log(`Scheduled ${scheduledEmails.length} follow-up emails for booking ${bookingId}`);
    }
  } catch (e: any) {
    console.warn('Error scheduling emails:', e.message);
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
    const { error } = await supabaseAdmin
      .from('scheduled_emails')
      .insert(scheduledEmail);

    if (error) {
      console.warn('Could not schedule event reminder email (table may not exist):', error.message);
      console.log('Event reminder email would be scheduled for:', scheduledEmail);
    } else {
      console.log(`Scheduled event reminder email for booking ${quote.id} at ${reminderTime.toISOString()}`);
    }
  } catch (e: any) {
    console.warn('Error scheduling event reminder email:', e.message);
  }
}



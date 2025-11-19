import { NextResponse } from 'next/server';
import { getDueScheduledEmails, markScheduledEmailAsSent, markScheduledEmailsAsSentBatch } from '@/lib/scheduled-emails';
import { getBookingsBatch } from '@/firebase/server-actions';
import { sendFollowUp3HEmail, sendFollowUp6HEmail, sendFollowUp24HEmail, sendFollowUp3DEmail, sendFollowUp6DEmail, sendFollowUp30DEmail, sendEventReminder24HEmail, sendAppointmentDayReminderEmail } from '@/lib/email';
import { logEmailEvent } from '@/lib/email-log';
import type { ScheduledEmail } from '@/lib/scheduled-emails';
import type { BookingDocument } from '@/firebase/firestore/bookings';

// Vercel runtime configuration - REQUIRED for cron jobs with longer execution
export const runtime = 'nodejs';
export const maxDuration = 10; // Maximum execution time in seconds (Vercel free plan limit)

// Configuration
const MAX_EXECUTION_TIME_MS = 9000; // 9 seconds (Vercel free plan limit is 10s, leave 1s buffer)
const MAX_CONCURRENT_EMAILS = 5; // Process max 5 emails in parallel
// No limit on total emails - processes ALL due emails in one cron execution

/**
 * Helper function to send email based on type
 */
async function sendEmailByType(
  emailType: ScheduledEmail['email_type'],
  quote: BookingDocument['finalQuote']
): Promise<void> {
  switch (emailType) {
    case 'followup-3h':
      await sendFollowUp3HEmail(quote);
      break;
    case 'followup-6h':
      await sendFollowUp6HEmail(quote);
      break;
    case 'followup-24h':
      await sendFollowUp24HEmail(quote);
      break;
    case 'followup-3d':
      await sendFollowUp3DEmail(quote);
      break;
    case 'followup-6d':
      await sendFollowUp6DEmail(quote);
      break;
    case 'followup-30d':
      await sendFollowUp30DEmail(quote);
      break;
    case 'event-reminder-24h':
      await sendEventReminder24HEmail(quote);
      break;
    case 'appointment-day-reminder':
      await sendAppointmentDayReminderEmail(quote);
      break;
    default:
      throw new Error(`Unknown email type: ${emailType}`);
  }
}

/**
 * Process a single scheduled email
 */
async function processScheduledEmail(
  scheduledEmail: ScheduledEmail,
  booking: BookingDocument | null,
  startTime: number
): Promise<{ success: boolean; shouldMarkAsSent: boolean; error?: string; skipped?: boolean }> {
  // Check execution time limit
  if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
    return {
      success: false,
      shouldMarkAsSent: false,
      error: 'Execution time limit reached',
    };
  }

  try {
    // Log processing start
    await logEmailEvent({
      scheduledEmailId: scheduledEmail.id,
      bookingId: scheduledEmail.booking_id,
      emailType: scheduledEmail.email_type,
      status: 'processing',
      detail: 'Attempting to send scheduled email',
    });

    // Check if booking exists
    if (!booking) {
      await logEmailEvent({
        scheduledEmailId: scheduledEmail.id,
        bookingId: scheduledEmail.booking_id,
        emailType: scheduledEmail.email_type,
        status: 'skipped',
        detail: 'Booking not found; marking as sent to prevent retries',
      });
      return {
        success: false,
        shouldMarkAsSent: true,
        skipped: true,
        error: 'Booking not found',
      };
    }

    // Don't send emails for cancelled bookings
    if (booking.finalQuote.status === 'cancelled') {
      await logEmailEvent({
        scheduledEmailId: scheduledEmail.id,
        bookingId: scheduledEmail.booking_id,
        emailType: scheduledEmail.email_type,
        status: 'skipped',
        detail: 'Booking is cancelled; email not sent',
      });
      return {
        success: false,
        shouldMarkAsSent: true,
        skipped: true,
        error: 'Booking is cancelled',
      };
    }

    // Handle event reminder emails
    if (scheduledEmail.email_type === 'event-reminder-24h' || scheduledEmail.email_type === 'appointment-day-reminder') {
      // Only send for confirmed bookings with payment
      if (booking.finalQuote.status !== 'confirmed') {
        await logEmailEvent({
          scheduledEmailId: scheduledEmail.id,
          bookingId: scheduledEmail.booking_id,
          emailType: scheduledEmail.email_type,
          status: 'skipped',
          detail: 'Booking not confirmed; reminder not sent',
        });
        return {
          success: false,
          shouldMarkAsSent: true,
          skipped: true,
          error: 'Booking not confirmed',
        };
      }

      const hasAdvancePayment = booking.finalQuote.paymentDetails &&
        (booking.finalQuote.paymentDetails.status === 'deposit-paid' ||
          booking.finalQuote.paymentDetails.status === 'payment-approved');

      if (!hasAdvancePayment) {
        await logEmailEvent({
          scheduledEmailId: scheduledEmail.id,
          bookingId: scheduledEmail.booking_id,
          emailType: scheduledEmail.email_type,
          status: 'skipped',
          detail: 'No advance payment; reminder not sent',
        });
        return {
          success: false,
          shouldMarkAsSent: true,
          skipped: true,
          error: 'No advance payment',
        };
      }

      await sendEmailByType(scheduledEmail.email_type, booking.finalQuote);
      await logEmailEvent({
        scheduledEmailId: scheduledEmail.id,
        bookingId: scheduledEmail.booking_id,
        emailType: scheduledEmail.email_type,
        status: 'sent',
        detail: 'Email sent successfully',
      });
      return {
        success: true,
        shouldMarkAsSent: true,
      };
    }

    // Handle follow-up emails - only send for 'quoted' status without payment
    if (booking.finalQuote.status !== 'quoted') {
      await logEmailEvent({
        scheduledEmailId: scheduledEmail.id,
        bookingId: scheduledEmail.booking_id,
        emailType: scheduledEmail.email_type,
        status: 'skipped',
        detail: `Booking status is ${booking.finalQuote.status}; follow-ups only send for quoted bookings`,
      });
      return {
        success: false,
        shouldMarkAsSent: true,
        skipped: true,
        error: `Status is ${booking.finalQuote.status}, not 'quoted'`,
      };
    }

    const hasAdvancePayment = booking.finalQuote.paymentDetails &&
      (booking.finalQuote.paymentDetails.status === 'deposit-paid' ||
        booking.finalQuote.paymentDetails.status === 'payment-approved');

    if (hasAdvancePayment) {
      await logEmailEvent({
        scheduledEmailId: scheduledEmail.id,
        bookingId: scheduledEmail.booking_id,
        emailType: scheduledEmail.email_type,
        status: 'skipped',
        detail: 'Advance payment already made; follow-up skipped',
      });
      return {
        success: false,
        shouldMarkAsSent: true,
        skipped: true,
        error: 'Advance payment already made',
      };
    }

    // Send the email
    await sendEmailByType(scheduledEmail.email_type, booking.finalQuote);
    await logEmailEvent({
      scheduledEmailId: scheduledEmail.id,
      bookingId: scheduledEmail.booking_id,
      emailType: scheduledEmail.email_type,
      status: 'sent',
      detail: 'Email sent successfully',
    });

    return {
      success: true,
      shouldMarkAsSent: true,
    };

  } catch (error: any) {
    await logEmailEvent({
      scheduledEmailId: scheduledEmail.id,
      bookingId: scheduledEmail.booking_id,
      emailType: scheduledEmail.email_type,
      status: 'failed',
      detail: error?.message || 'Unknown error while sending email',
    });
    return {
      success: false,
      shouldMarkAsSent: false,
      error: error?.message || 'Unknown error',
    };
  }
}

/**
 * Process emails in batches with concurrency limit
 * Processes ALL emails, stops gracefully if time limit approaches
 */
async function processEmailsInBatches(
  emails: ScheduledEmail[],
  bookingsMap: Map<string, BookingDocument | null>,
  startTime: number
): Promise<{ processed: number; failed: number; skipped: number; errors: string[] }> {
  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  const emailsToMarkAsSent: string[] = [];
  const emailsProcessed: Array<{ email: ScheduledEmail; result: any }> = [];

  // Process ALL emails in batches to respect concurrency limit (no limit on total emails)
  for (let i = 0; i < emails.length; i += MAX_CONCURRENT_EMAILS) {
    // Check execution time limit before processing next batch
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_EXECUTION_TIME_MS) {
      console.log(`[EMAIL PROCESSOR] Execution time limit reached. Processed ${i} of ${emails.length} emails. Remaining will be processed next hour.`);
      results.errors.push(`Execution time limit reached after ${i} emails (${elapsed}ms)`);
      break;
    }

    const batch = emails.slice(i, i + MAX_CONCURRENT_EMAILS);
    const batchPromises = batch.map(async (scheduledEmail) => {
      const booking = bookingsMap.get(scheduledEmail.booking_id) || null;
      const result = await processScheduledEmail(scheduledEmail, booking, startTime);
      return { email: scheduledEmail, result };
    });

    const batchResults = await Promise.all(batchPromises);
    emailsProcessed.push(...batchResults);

    // Update results based on batch outcomes
    for (const { email, result } of batchResults) {
      if (result.success) {
        results.processed++;
        if (result.shouldMarkAsSent) {
          emailsToMarkAsSent.push(email.id!);
        }
      } else if (result.skipped) {
        results.skipped++;
        if (result.shouldMarkAsSent) {
          emailsToMarkAsSent.push(email.id!);
        }
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`Email ${email.id}: ${result.error}`);
        }
        // Don't mark failed emails as sent - they'll retry
      }
    }
  }

  // Batch mark emails as sent for better performance
  if (emailsToMarkAsSent.length > 0) {
    try {
      await markScheduledEmailsAsSentBatch(emailsToMarkAsSent);
      console.log(`Marked ${emailsToMarkAsSent.length} emails as sent in batch`);
    } catch (error: any) {
      console.error('Error batch marking emails as sent:', error);
      // Fallback to individual marking
      for (const emailId of emailsToMarkAsSent) {
        try {
          await markScheduledEmailAsSent(emailId);
        } catch (e) {
          console.error(`Failed to mark email ${emailId} as sent:`, e);
        }
      }
    }
  }

  return results;
}

/**
 * Optimized API route to process scheduled emails
 * 
 * Features:
 * - Processes ALL due emails in one execution (no limit)
 * - Batch database queries for better performance
 * - Parallel email processing with concurrency limits
 * - Execution time monitoring (stops gracefully if timeout approaches)
 * - Single hourly cron job to avoid CORS and rate limiting issues
 * - Batch marking of emails as sent for better performance
 * 
 * Scheduled to run hourly via Vercel Cron:
 * - Schedule: "0 * * * *" (every hour at minute 0)
 * - Processes ALL due emails in one execution
 * - Emails sent at their scheduled time (with up to ~1 hour delay)
 * - Avoids multiple API calls and CORS issues
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  
  // Optional: Add authentication/authorization here
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[EMAIL PROCESSOR] Starting scheduled email processing at ${new Date().toISOString()}`);
    
    // Fetch all due emails
    const dueEmails = await getDueScheduledEmails();
    
    if (dueEmails.length === 0) {
      const executionTime = Date.now() - startTime;
      console.log(`[EMAIL PROCESSOR] No scheduled emails due (execution: ${executionTime}ms)`);
      return NextResponse.json({ 
        message: 'No scheduled emails due',
        processed: 0,
        executionTimeMs: executionTime,
      });
    }

    console.log(`[EMAIL PROCESSOR] Found ${dueEmails.length} due emails - processing ALL`);

    // Extract unique booking IDs from ALL due emails
    const bookingIds = Array.from(new Set(dueEmails.map(e => e.booking_id)));

    // Batch fetch all bookings in one query (major optimization)
    console.log(`[EMAIL PROCESSOR] Fetching ${bookingIds.length} bookings in batch`);
    const bookingsMap = await getBookingsBatch(bookingIds);
    console.log(`[EMAIL PROCESSOR] Retrieved ${bookingsMap.size} bookings`);

    // Process ALL emails with concurrency limits and time monitoring
    const results = await processEmailsInBatches(dueEmails, bookingsMap, startTime);

    const executionTime = Date.now() - startTime;
    const totalProcessed = results.processed + results.failed + results.skipped;
    const summary = {
      message: `Processed ${results.processed} emails, ${results.failed} failed, ${results.skipped} skipped`,
      totalDue: dueEmails.length,
      processed: results.processed,
      failed: results.failed,
      skipped: results.skipped,
      errors: results.errors.slice(0, 10), // Limit error details in response
      executionTimeMs: executionTime,
      remainingDue: Math.max(0, dueEmails.length - totalProcessed), // Emails that couldn't be processed due to timeout
    };

    console.log(`[EMAIL PROCESSOR] Completed: ${summary.message} (execution: ${executionTime}ms)`);

    return NextResponse.json(summary);

  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error('[EMAIL PROCESSOR] Error in scheduled emails processor:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Unknown error',
        executionTimeMs: executionTime,
      },
      { status: 500 }
    );
  }
}

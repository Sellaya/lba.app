import { NextResponse } from 'next/server';
import { getDueScheduledEmails, markScheduledEmailAsSent } from '@/lib/scheduled-emails';
import { getBooking } from '@/firebase/server-actions';
import { sendFollowUp3HEmail, sendFollowUp6HEmail, sendFollowUp24HEmail, sendFollowUp3DEmail, sendFollowUp6DEmail, sendFollowUp30DEmail, sendEventReminder24HEmail, sendAppointmentDayReminderEmail } from '@/lib/email';

/**
 * API route to process scheduled emails
 * This should be called by a cron job every 5-10 minutes
 * 
 * To set up a cron job:
 * 1. Use a service like Vercel Cron, GitHub Actions, or a traditional cron
 * 2. Call this endpoint: GET /api/scheduled-emails/process
 * 3. For Vercel, add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/scheduled-emails/process",
 *        "schedule": "every 10 minutes"
 *      }]
 *    }
 */
export async function GET(request: Request) {
  // Optional: Add authentication/authorization here
  // For example, check for a secret token in headers
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dueEmails = await getDueScheduledEmails();
    
    if (dueEmails.length === 0) {
      return NextResponse.json({ 
        message: 'No scheduled emails due',
        processed: 0 
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const scheduledEmail of dueEmails) {
      try {
        // Fetch the booking
        const booking = await getBooking(scheduledEmail.booking_id);
        
        if (!booking) {
          console.error(`Booking ${scheduledEmail.booking_id} not found for scheduled email ${scheduledEmail.id}`);
          results.failed++;
          results.errors.push(`Booking ${scheduledEmail.booking_id} not found`);
          // Mark as sent to avoid retrying
          await markScheduledEmailAsSent(scheduledEmail.id!);
          continue;
        }

        // Handle event reminder emails differently - they should only be sent for confirmed bookings
        if (scheduledEmail.email_type === 'event-reminder-24h') {
          // For event reminders, only send if booking is confirmed
          if (booking.finalQuote.status !== 'confirmed') {
            console.log(`Skipping event reminder email for non-confirmed booking ${scheduledEmail.booking_id}`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }
          
          // Check if advance payment has been made
          const hasAdvancePayment = booking.finalQuote.paymentDetails && 
            (booking.finalQuote.paymentDetails.status === 'deposit-paid' || 
             booking.finalQuote.paymentDetails.status === 'payment-approved');
          
          if (!hasAdvancePayment) {
            console.log(`Skipping event reminder email for booking ${scheduledEmail.booking_id} - no advance payment`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }

          await sendEventReminder24HEmail(booking.finalQuote);
        } else if (scheduledEmail.email_type === 'appointment-day-reminder') {
          // For appointment day reminders, only send if booking is confirmed
          if (booking.finalQuote.status !== 'confirmed') {
            console.log(`Skipping appointment day reminder email for non-confirmed booking ${scheduledEmail.booking_id}`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }
          
          // Check if advance payment has been made
          const hasAdvancePayment = booking.finalQuote.paymentDetails && 
            (booking.finalQuote.paymentDetails.status === 'deposit-paid' || 
             booking.finalQuote.paymentDetails.status === 'payment-approved');
          
          if (!hasAdvancePayment) {
            console.log(`Skipping appointment day reminder email for booking ${scheduledEmail.booking_id} - no advance payment`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }

          await sendAppointmentDayReminderEmail(booking.finalQuote);
        } else {
          // For follow-up emails, only send if status is 'quoted' and no advance payment has been made
          if (booking.finalQuote.status !== 'quoted') {
            console.log(`Skipping scheduled email for booking ${scheduledEmail.booking_id} - status is not 'quoted' (current: ${booking.finalQuote.status})`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }

          // Check if advance payment has been made - don't send follow-ups if payment is made
          const hasAdvancePayment = booking.finalQuote.paymentDetails && 
            (booking.finalQuote.paymentDetails.status === 'deposit-paid' || 
             booking.finalQuote.paymentDetails.status === 'payment-approved');
          
          if (hasAdvancePayment) {
            console.log(`Skipping scheduled email for booking ${scheduledEmail.booking_id} - advance payment already made`);
            await markScheduledEmailAsSent(scheduledEmail.id!);
            continue;
          }

          // Send the appropriate follow-up email
          switch (scheduledEmail.email_type) {
            case 'followup-3h':
              await sendFollowUp3HEmail(booking.finalQuote);
              break;
            case 'followup-6h':
              await sendFollowUp6HEmail(booking.finalQuote);
              break;
            case 'followup-24h':
              await sendFollowUp24HEmail(booking.finalQuote);
              break;
            case 'followup-3d':
              await sendFollowUp3DEmail(booking.finalQuote);
              break;
            case 'followup-6d':
              await sendFollowUp6DEmail(booking.finalQuote);
              break;
            case 'followup-30d':
              await sendFollowUp30DEmail(booking.finalQuote);
              break;
            default:
              console.warn(`Unknown email type: ${scheduledEmail.email_type}`);
              results.failed++;
              continue;
          }
        }

        // Mark as sent
        await markScheduledEmailAsSent(scheduledEmail.id!);
        results.processed++;
        
      } catch (error: any) {
        console.error(`Error processing scheduled email ${scheduledEmail.id}:`, error);
        results.failed++;
        results.errors.push(`Email ${scheduledEmail.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${results.processed} emails, ${results.failed} failed`,
      ...results,
    });

  } catch (error: any) {
    console.error('Error in scheduled emails processor:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}


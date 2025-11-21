import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { schedulePostAppointmentFollowupEmail } from '@/lib/scheduled-emails';
import type { FinalQuote } from '@/lib/types';

/**
 * API endpoint to backfill post-appointment followup emails for existing bookings
 * This schedules post-appointment emails for confirmed bookings that already have other emails scheduled
 * but are missing the post-appointment followup email
 * 
 * Usage: POST /api/admin/backfill-post-appointment-emails
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check here
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[BACKFILL POST-APPOINTMENT] Starting to backfill post-appointment emails for existing bookings...');

    // Fetch all confirmed bookings from Supabase
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote')
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('[BACKFILL POST-APPOINTMENT] Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: `Failed to fetch bookings: ${bookingsError.message}` },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No bookings found',
        processed: 0,
        skipped: 0,
        errors: [],
      });
    }

    console.log(`[BACKFILL POST-APPOINTMENT] Found ${bookings.length} bookings to check`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each booking
    for (const booking of bookings) {
      try {
        const bookingId = booking.id;
        const finalQuote = booking.final_quote as FinalQuote;

        if (!finalQuote) {
          console.warn(`[BACKFILL POST-APPOINTMENT] Booking ${bookingId} has no final_quote, skipping...`);
          results.skipped++;
          continue;
        }

        // Only process confirmed bookings with payment
        if (finalQuote.status !== 'confirmed') {
          results.skipped++;
          continue;
        }

        // Check if advance payment has been made
        const hasAdvancePayment = finalQuote.paymentDetails && 
          (finalQuote.paymentDetails.status === 'deposit-paid' || 
           finalQuote.paymentDetails.status === 'payment-approved');
        
        if (!hasAdvancePayment) {
          results.skipped++;
          continue;
        }

        // Check if post-appointment followup email already exists
        const { data: existingEmails } = await supabaseAdmin
          .from('scheduled_emails')
          .select('email_type')
          .eq('booking_id', bookingId)
          .eq('email_type', 'post-appointment-followup')
          .limit(1);

        // If email already exists, skip
        if (existingEmails && existingEmails.length > 0) {
          console.log(`[BACKFILL POST-APPOINTMENT] Booking ${bookingId} already has post-appointment followup email, skipping...`);
          results.skipped++;
          continue;
        }

        // Schedule post-appointment followup email
        await schedulePostAppointmentFollowupEmail(finalQuote);

        results.processed++;
        console.log(`[BACKFILL POST-APPOINTMENT] Successfully scheduled post-appointment email for booking ${bookingId}`);

      } catch (error: any) {
        const errorMsg = `Booking ${booking.id}: ${error.message}`;
        console.error(`[BACKFILL POST-APPOINTMENT] Error processing booking ${booking.id}:`, error);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[BACKFILL POST-APPOINTMENT] Completed. Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      message: `Backfilled post-appointment emails for ${results.processed} bookings`,
      ...results,
    });

  } catch (e: any) {
    console.error('[BACKFILL POST-APPOINTMENT] Unexpected error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to backfill post-appointment emails' },
      { status: 500 }
    );
  }
}


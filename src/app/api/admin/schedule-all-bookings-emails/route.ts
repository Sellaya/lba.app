import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getBooking } from '@/firebase/server-actions';
import { scheduleFollowUpEmails, scheduleEventReminder24HEmail, scheduleAppointmentDayReminderEmail, schedulePostAppointmentFollowupEmail } from '@/lib/scheduled-emails';

/**
 * API endpoint to schedule emails for all existing bookings
 * This should be run once after creating the scheduled_emails table
 * 
 * Usage: POST /api/admin/schedule-all-bookings-emails
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check here
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[SCHEDULE ALL] Starting to schedule emails for all existing bookings...');

    // Fetch all bookings from Supabase (include created_at for proper scheduling)
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote, created_at')
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('[SCHEDULE ALL] Error fetching bookings:', bookingsError);
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

    console.log(`[SCHEDULE ALL] Found ${bookings.length} bookings to process`);

    const results = {
      processed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each booking
    for (const booking of bookings) {
      try {
        const bookingId = booking.id;
        const finalQuote = booking.final_quote;

        if (!finalQuote) {
          console.warn(`[SCHEDULE ALL] Booking ${bookingId} has no final_quote, skipping...`);
          results.skipped++;
          continue;
        }

        // Check if emails are already scheduled
        const { data: existingEmails } = await supabaseAdmin
          .from('scheduled_emails')
          .select('email_type')
          .eq('booking_id', bookingId)
          .limit(1);

        // If emails already exist, skip
        if (existingEmails && existingEmails.length > 0) {
          console.log(`[SCHEDULE ALL] Booking ${bookingId} already has scheduled emails, skipping...`);
          results.skipped++;
          continue;
        }

        // Schedule follow-up emails (only if status is 'quoted' and no payment)
        // Use booking's created_at timestamp for proper scheduling relative to booking creation
        const bookingCreatedAt = booking.created_at ? new Date(booking.created_at) : undefined;
        await scheduleFollowUpEmails(finalQuote, bookingCreatedAt);

        // Schedule event reminder, appointment day reminder, and post-appointment followup (only if confirmed with payment)
        if (finalQuote.status === 'confirmed') {
          await scheduleEventReminder24HEmail(finalQuote);
          await scheduleAppointmentDayReminderEmail(finalQuote);
          await schedulePostAppointmentFollowupEmail(finalQuote);
        }

        results.processed++;
        console.log(`[SCHEDULE ALL] Successfully scheduled emails for booking ${bookingId}`);

      } catch (error: any) {
        const errorMsg = `Booking ${booking.id}: ${error.message}`;
        console.error(`[SCHEDULE ALL] Error processing booking ${booking.id}:`, error);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[SCHEDULE ALL] Completed. Processed: ${results.processed}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      message: `Scheduled emails for ${results.processed} bookings`,
      ...results,
    });

  } catch (e: any) {
    console.error('[SCHEDULE ALL] Unexpected error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to schedule emails for all bookings' },
      { status: 500 }
    );
  }
}


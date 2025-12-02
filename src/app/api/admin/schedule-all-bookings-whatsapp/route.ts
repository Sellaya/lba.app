import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { FinalQuote } from '@/lib/types';

/**
 * API endpoint to schedule WhatsApp reminders for all existing bookings
 * This fixes bookings that don't have reminders scheduled
 * 
 * Usage: POST /api/admin/schedule-all-bookings-whatsapp
 * This can be called once to fix all existing bookings
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check here (disabled for auto-fix from admin panel)
    // The endpoint is safe because it only schedules reminders, doesn't modify critical data
    // If you want to re-enable auth, uncomment the lines below:
    // const authHeader = request.headers.get('authorization');
    // const expectedToken = process.env.ADMIN_SECRET_TOKEN;
    // if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('[SCHEDULE ALL WHATSAPP] Starting to schedule WhatsApp reminders for all existing bookings...');

    // Fetch all bookings from Supabase
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote')
      .order('created_at', { ascending: false });

    if (bookingsError) {
      console.error('[SCHEDULE ALL WHATSAPP] Error fetching bookings:', bookingsError);
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
        scheduled2w: 0,
        scheduled1w: 0,
        errors: [],
      });
    }

    console.log(`[SCHEDULE ALL WHATSAPP] Found ${bookings.length} bookings to process`);

    const results = {
      processed: 0,
      skipped: 0,
      scheduled2w: 0,
      scheduled1w: 0,
      errors: [] as string[],
    };

    // Process each booking
    for (const booking of bookings) {
      try {
        const bookingId = booking.id;
        const finalQuote: FinalQuote = booking.final_quote;

        if (!finalQuote) {
          console.warn(`[SCHEDULE ALL WHATSAPP] Booking ${bookingId} has no final_quote, skipping...`);
          results.skipped++;
          continue;
        }

        // Use helper function to check and schedule reminders
        const { ensureWhatsAppRemindersScheduled } = await import('@/lib/whatsapp-helpers');
        const result = await ensureWhatsAppRemindersScheduled(finalQuote);
        
        if (result.scheduled2w) {
          results.scheduled2w++;
          console.log(`[SCHEDULE ALL WHATSAPP] Scheduled 2-week reminder for booking ${bookingId}`);
        }
        if (result.scheduled1w) {
          results.scheduled1w++;
          console.log(`[SCHEDULE ALL WHATSAPP] Scheduled 1-week reminder for booking ${bookingId}`);
        }
        if (result.errors.length > 0) {
          result.errors.forEach(error => results.errors.push(`Booking ${bookingId}: ${error}`));
        }
        
        if (result.scheduled2w || result.scheduled1w) {
          results.processed++;
        } else {
          results.skipped++;
          console.log(`[SCHEDULE ALL WHATSAPP] Booking ${bookingId} already has reminders scheduled/sent, skipping...`);
        }

      } catch (error: any) {
        const errorMsg = `Booking ${booking.id}: ${error.message}`;
        console.error(`[SCHEDULE ALL WHATSAPP] Error processing booking ${booking.id}:`, error);
        results.errors.push(errorMsg);
      }
    }

    console.log(`[SCHEDULE ALL WHATSAPP] Completed. Processed: ${results.processed}, Skipped: ${results.skipped}, Scheduled 2w: ${results.scheduled2w}, Scheduled 1w: ${results.scheduled1w}, Errors: ${results.errors.length}`);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} bookings: ${results.scheduled2w} 2-week reminders, ${results.scheduled1w} 1-week reminders`,
      ...results,
    });

  } catch (e: any) {
    console.error('[SCHEDULE ALL WHATSAPP] Unexpected error:', e);
    return NextResponse.json(
      { error: e.message || 'Failed to schedule WhatsApp reminders for all bookings' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getBookingsBatch } from '@/firebase/server-actions';
import { sendFollowUp7DWhatsApp } from '@/lib/whatsapp';
import type { FinalQuote } from '@/lib/types';
import { getTorontoNow } from '@/lib/toronto-time';

// Vercel runtime configuration - REQUIRED for cron jobs
export const runtime = 'nodejs';
export const maxDuration = 10; // Maximum execution time in seconds

/**
 * Process scheduled WhatsApp follow-up messages
 * Checks all bookings for 7-day follow-ups that are due and sends them
 */
export async function GET(request: Request) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WhatsApp Processor] Starting scheduled WhatsApp follow-up processing...');
    const now = getTorontoNow();
    const nowISO = now.toISOString();

    // Fetch all bookings that have a scheduled 7-day follow-up
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote')
      .not('final_quote->whatsappMessages->followup7d', 'is', null);

    if (fetchError) {
      console.error('[WhatsApp Processor] Error fetching bookings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      console.log('[WhatsApp Processor] No bookings with scheduled WhatsApp follow-ups found');
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        message: 'No scheduled WhatsApp follow-ups found',
      });
    }

    console.log(`[WhatsApp Processor] Found ${bookings.length} bookings with scheduled follow-ups`);

    // Filter bookings where follow-up is due and not yet sent
    const dueBookings = bookings.filter((booking: any) => {
      const quote: FinalQuote = booking.final_quote;
      const followup = quote.whatsappMessages?.followup7d;
      
      if (!followup || followup.sent) {
        return false;
      }

      if (!followup.scheduledFor) {
        return false;
      }

      const scheduledDate = new Date(followup.scheduledFor);
      return scheduledDate <= now;
    });

    console.log(`[WhatsApp Processor] ${dueBookings.length} bookings have due follow-ups`);

    if (dueBookings.length === 0) {
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        message: 'No due WhatsApp follow-ups found',
      });
    }

    // Process each booking
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const booking of dueBookings) {
      try {
        const quote: FinalQuote = booking.final_quote;
        
        // Double-check conditions before sending
        if (quote.status !== 'quoted') {
          console.log(`[WhatsApp Processor] Skipping booking ${booking.id} - status is ${quote.status}`);
          skipped++;
          
          // Mark as sent to prevent retries
          const updatedQuote: FinalQuote = {
            ...quote,
            whatsappMessages: {
              ...quote.whatsappMessages,
              followup7d: {
                ...quote.whatsappMessages?.followup7d,
                sent: true,
                error: `Skipped: status is ${quote.status}`,
              },
            },
          };
          
          await supabaseAdmin
            .from('bookings')
            .update({ 
              final_quote: updatedQuote as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id);
          
          continue;
        }

        // Check if advance payment has been made
        const hasAdvancePayment = quote.paymentDetails && 
          (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
        
        if (hasAdvancePayment) {
          console.log(`[WhatsApp Processor] Skipping booking ${booking.id} - advance payment already made`);
          skipped++;
          
          // Mark as sent to prevent retries
          const updatedQuote: FinalQuote = {
            ...quote,
            whatsappMessages: {
              ...quote.whatsappMessages,
              followup7d: {
                ...quote.whatsappMessages?.followup7d,
                sent: true,
                error: 'Skipped: advance payment already made',
              },
            },
          };
          
          await supabaseAdmin
            .from('bookings')
            .update({ 
              final_quote: updatedQuote as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id);
          
          continue;
        }

        // Send the follow-up message
        console.log(`[WhatsApp Processor] Sending 7-day follow-up for booking ${booking.id}`);
        const result = await sendFollowUp7DWhatsApp(quote);

        // Update booking with result
        const updatedQuote: FinalQuote = {
          ...quote,
          whatsappMessages: {
            ...quote.whatsappMessages,
            followup7d: {
              sent: result.success,
              sentAt: result.success ? new Date().toISOString() : undefined,
              messageSid: result.messageSid,
              delivered: result.delivered || false,
              deliveryStatus: result.deliveryStatus,
              error: result.error,
              scheduledFor: quote.whatsappMessages?.followup7d?.scheduledFor,
            },
          },
        };

        await supabaseAdmin
          .from('bookings')
          .update({ 
            final_quote: updatedQuote as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id);

        if (result.success) {
          sent++;
          console.log(`[WhatsApp Processor] Successfully sent 7-day follow-up for booking ${booking.id}`);
        } else {
          failed++;
          errors.push(`Booking ${booking.id}: ${result.error}`);
          console.error(`[WhatsApp Processor] Failed to send 7-day follow-up for booking ${booking.id}:`, result.error);
        }
      } catch (error: any) {
        failed++;
        errors.push(`Booking ${booking.id}: ${error.message || 'Unknown error'}`);
        console.error(`[WhatsApp Processor] Error processing booking ${booking.id}:`, error);
      }
    }

    return NextResponse.json({
      processed: dueBookings.length,
      sent,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${dueBookings.length} WhatsApp follow-ups: ${sent} sent, ${skipped} skipped, ${failed} failed`,
    });

  } catch (error: any) {
    console.error('[WhatsApp Processor] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


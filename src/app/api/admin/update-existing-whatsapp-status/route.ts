import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { checkMessageDeliveryStatus } from '@/lib/whatsapp';
import type { FinalQuote } from '@/lib/types';

/**
 * Update existing bookings with WhatsApp status
 * This endpoint should be called once to migrate existing bookings
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[WhatsApp Migration] Starting update of existing bookings...');

    // Fetch all bookings
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote')
      .not('final_quote', 'is', null);

    if (fetchError) {
      console.error('[WhatsApp Migration] Error fetching bookings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        updated: 0,
        message: 'No bookings found',
      });
    }

    console.log(`[WhatsApp Migration] Found ${bookings.length} bookings to process`);

    let updated = 0;
    let checked = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      try {
        const quote: FinalQuote = booking.final_quote;
        let needsUpdate = false;
        const updatedWhatsAppMessages = { ...quote.whatsappMessages };

        // Check initial message
        if (quote.whatsappMessages?.initial?.messageSid && !quote.whatsappMessages.initial.delivered) {
          checked++;
          console.log(`[WhatsApp Migration] Checking delivery status for booking ${booking.id} initial message...`);
          const deliveryStatus = await checkMessageDeliveryStatus(quote.whatsappMessages.initial.messageSid);
          
          if (deliveryStatus.deliveryStatus !== 'unknown') {
            needsUpdate = true;
            updatedWhatsAppMessages.initial = {
              ...quote.whatsappMessages.initial,
              delivered: deliveryStatus.delivered,
              deliveryStatus: deliveryStatus.deliveryStatus,
            };
          }
        } else if (!quote.whatsappMessages?.initial) {
          // Mark as not sent if no WhatsApp data exists
          needsUpdate = true;
          updatedWhatsAppMessages.initial = {
            sent: false,
          };
        }

        // Check follow-up message
        if (quote.whatsappMessages?.followup7d?.messageSid && !quote.whatsappMessages.followup7d.delivered) {
          checked++;
          console.log(`[WhatsApp Migration] Checking delivery status for booking ${booking.id} follow-up message...`);
          const deliveryStatus = await checkMessageDeliveryStatus(quote.whatsappMessages.followup7d.messageSid);
          
          if (deliveryStatus.deliveryStatus !== 'unknown') {
            needsUpdate = true;
            updatedWhatsAppMessages.followup7d = {
              ...quote.whatsappMessages.followup7d,
              delivered: deliveryStatus.delivered,
              deliveryStatus: deliveryStatus.deliveryStatus,
            };
          }
        } else if (!quote.whatsappMessages?.followup7d) {
          // Don't mark follow-up as not sent if it was never scheduled
          // Only initialize if it doesn't exist and we're updating initial
          if (needsUpdate) {
            updatedWhatsAppMessages.followup7d = quote.whatsappMessages?.followup7d;
          }
        }

        if (needsUpdate) {
          const updatedQuote: FinalQuote = {
            ...quote,
            whatsappMessages: updatedWhatsAppMessages,
          };

          const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .update({ 
              final_quote: updatedQuote as any,
              updated_at: new Date().toISOString(),
            })
            .eq('id', booking.id);

          if (updateError) {
            errors.push(`Booking ${booking.id}: ${updateError.message}`);
            console.error(`[WhatsApp Migration] Failed to update booking ${booking.id}:`, updateError);
          } else {
            updated++;
            console.log(`[WhatsApp Migration] Updated booking ${booking.id}`);
          }
        }
      } catch (error: any) {
        errors.push(`Booking ${booking.id}: ${error.message || 'Unknown error'}`);
        console.error(`[WhatsApp Migration] Error processing booking ${booking.id}:`, error);
      }
    }

    return NextResponse.json({
      total: bookings.length,
      checked,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${bookings.length} bookings: ${updated} updated, ${checked} delivery statuses checked`,
    });

  } catch (error: any) {
    console.error('[WhatsApp Migration] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}




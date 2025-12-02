import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getBookingsBatch } from '@/firebase/server-actions';
import { sendFollowUp7DWhatsApp, sendReminder2WWhatsApp, sendReminder1WWhatsApp } from '@/lib/whatsapp';
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

    console.log('[WhatsApp Processor] Starting scheduled WhatsApp reminder processing...');
    const now = getTorontoNow();

    // Fetch all bookings that have any scheduled reminders (2w, 1w, or 7d)
    const { data: bookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, final_quote')
      .or('final_quote->whatsappMessages->reminder2w.not.is.null,final_quote->whatsappMessages->reminder1w.not.is.null,final_quote->whatsappMessages->followup7d.not.is.null');

    if (fetchError) {
      console.error('[WhatsApp Processor] Error fetching bookings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      console.log('[WhatsApp Processor] No bookings with scheduled WhatsApp reminders found');
      return NextResponse.json({
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        message: 'No scheduled WhatsApp reminders found',
      });
    }

    console.log(`[WhatsApp Processor] Found ${bookings.length} bookings with scheduled reminders`);

    // Process each booking
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      try {
        const quote: FinalQuote = booking.final_quote;
        let processed = false;

        // Check 2-week reminder
        const reminder2w = quote.whatsappMessages?.reminder2w;
        if (reminder2w && !reminder2w.sent && reminder2w.scheduledFor) {
          const scheduledDate = new Date(reminder2w.scheduledFor);
          if (scheduledDate <= now) {
            processed = true;
            
            // Double-check conditions before sending
            if (quote.status !== 'quoted') {
              console.log(`[WhatsApp Processor] Skipping 2-week reminder for booking ${booking.id} - status is ${quote.status}`);
              skipped++;
              
              const updatedQuote: FinalQuote = {
                ...quote,
                whatsappMessages: {
                  ...quote.whatsappMessages,
                  reminder2w: {
                    ...reminder2w,
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
            } else {
              const hasAdvancePayment = quote.paymentDetails && 
                (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
              
              if (hasAdvancePayment) {
                console.log(`[WhatsApp Processor] Skipping 2-week reminder for booking ${booking.id} - advance payment already made`);
                skipped++;
                
                const updatedQuote: FinalQuote = {
                  ...quote,
                  whatsappMessages: {
                    ...quote.whatsappMessages,
                    reminder2w: {
                      ...reminder2w,
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
              } else {
                console.log(`[WhatsApp Processor] Sending 2-week reminder for booking ${booking.id}`);
                const result = await sendReminder2WWhatsApp(quote);

                const updatedQuote: FinalQuote = {
                  ...quote,
                  whatsappMessages: {
                    ...quote.whatsappMessages,
                    reminder2w: {
                      sent: result.success,
                      sentAt: result.success ? new Date().toISOString() : undefined,
                      messageSid: result.messageSid,
                      delivered: result.delivered || false,
                      deliveryStatus: result.deliveryStatus,
                      error: result.error,
                      scheduledFor: reminder2w.scheduledFor,
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
                  console.log(`[WhatsApp Processor] Successfully sent 2-week reminder for booking ${booking.id}`);
                } else {
                  failed++;
                  errors.push(`Booking ${booking.id} (2w): ${result.error}`);
                  console.error(`[WhatsApp Processor] Failed to send 2-week reminder for booking ${booking.id}:`, result.error);
                }
              }
            }
          }
        }

        // Check 1-week reminder (only if 2-week wasn't processed)
        if (!processed) {
          const reminder1w = quote.whatsappMessages?.reminder1w;
          if (reminder1w && !reminder1w.sent && reminder1w.scheduledFor) {
            const scheduledDate = new Date(reminder1w.scheduledFor);
            if (scheduledDate <= now) {
              processed = true;
              
              // Double-check conditions before sending
              if (quote.status !== 'quoted') {
                console.log(`[WhatsApp Processor] Skipping 1-week reminder for booking ${booking.id} - status is ${quote.status}`);
                skipped++;
                
                const updatedQuote: FinalQuote = {
                  ...quote,
                  whatsappMessages: {
                    ...quote.whatsappMessages,
                    reminder1w: {
                      ...reminder1w,
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
              } else {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                
                if (hasAdvancePayment) {
                  console.log(`[WhatsApp Processor] Skipping 1-week reminder for booking ${booking.id} - advance payment already made`);
                  skipped++;
                  
                  const updatedQuote: FinalQuote = {
                    ...quote,
                    whatsappMessages: {
                      ...quote.whatsappMessages,
                      reminder1w: {
                        ...reminder1w,
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
                } else {
                  console.log(`[WhatsApp Processor] Sending 1-week reminder for booking ${booking.id}`);
                  const result = await sendReminder1WWhatsApp(quote);

                  const updatedQuote: FinalQuote = {
                    ...quote,
                    whatsappMessages: {
                      ...quote.whatsappMessages,
                      reminder1w: {
                        sent: result.success,
                        sentAt: result.success ? new Date().toISOString() : undefined,
                        messageSid: result.messageSid,
                        delivered: result.delivered || false,
                        deliveryStatus: result.deliveryStatus,
                        error: result.error,
                        scheduledFor: reminder1w.scheduledFor,
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
                    console.log(`[WhatsApp Processor] Successfully sent 1-week reminder for booking ${booking.id}`);
                  } else {
                    failed++;
                    errors.push(`Booking ${booking.id} (1w): ${result.error}`);
                    console.error(`[WhatsApp Processor] Failed to send 1-week reminder for booking ${booking.id}:`, result.error);
                  }
                }
              }
            }
          }
        }

        // Check 7-day follow-up (only if neither 2w nor 1w was processed)
        if (!processed) {
          const followup = quote.whatsappMessages?.followup7d;
          if (followup && !followup.sent && followup.scheduledFor) {
            const scheduledDate = new Date(followup.scheduledFor);
            if (scheduledDate <= now) {
              processed = true;
              
              // Double-check conditions before sending
              if (quote.status !== 'quoted') {
                console.log(`[WhatsApp Processor] Skipping 7-day follow-up for booking ${booking.id} - status is ${quote.status}`);
                skipped++;
                
                const updatedQuote: FinalQuote = {
                  ...quote,
                  whatsappMessages: {
                    ...quote.whatsappMessages,
                    followup7d: {
                      ...followup,
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
              } else {
                const hasAdvancePayment = quote.paymentDetails && 
                  (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
                
                if (hasAdvancePayment) {
                  console.log(`[WhatsApp Processor] Skipping 7-day follow-up for booking ${booking.id} - advance payment already made`);
                  skipped++;
                  
                  const updatedQuote: FinalQuote = {
                    ...quote,
                    whatsappMessages: {
                      ...quote.whatsappMessages,
                      followup7d: {
                        ...followup,
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
                } else {
                  console.log(`[WhatsApp Processor] Sending 7-day follow-up for booking ${booking.id}`);
                  const result = await sendFollowUp7DWhatsApp(quote);

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
                        scheduledFor: followup.scheduledFor,
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
                    errors.push(`Booking ${booking.id} (7d): ${result.error}`);
                    console.error(`[WhatsApp Processor] Failed to send 7-day follow-up for booking ${booking.id}:`, result.error);
                  }
                }
              }
            }
          }
        }
      } catch (error: any) {
        failed++;
        errors.push(`Booking ${booking.id}: ${error.message || 'Unknown error'}`);
        console.error(`[WhatsApp Processor] Error processing booking ${booking.id}:`, error);
      }
    }

    return NextResponse.json({
      processed: bookings.length,
      sent,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      message: `Processed ${bookings.length} bookings: ${sent} sent, ${skipped} skipped, ${failed} failed`,
    });

  } catch (error: any) {
    console.error('[WhatsApp Processor] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}


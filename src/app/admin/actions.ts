'use server';

import 'dotenv/config';
import { getBooking } from '@/firebase/server-actions';
import { sendQuoteEmail, sendAdminScreenshotNotification, sendRejectionEmail, sendFinalPaymentConfirmationEmail, sendFollowUp24HEmail, sendFollowUp3DEmail, sendFollowUp6DEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase/server';
import { scheduleFollowUpEmails, scheduleEventReminder24HEmail, scheduleAppointmentDayReminderEmail, schedulePostAppointmentFollowupEmail } from '@/lib/scheduled-emails';
import { sendQuoteWhatsApp } from '@/lib/whatsapp';
import type { FinalQuote } from '@/lib/types';
import { formatToronto } from '@/lib/toronto-time';


type ActionResult = {
  success: boolean;
  message: string;
};

// Save a newly generated quote to Supabase and send the quote email (server-side, uses service role)
export async function saveQuoteAndEmailAction(quote: FinalQuote): Promise<ActionResult> {
  console.log('saveQuoteAndEmailAction: Starting, booking ID:', quote?.id);
  console.log('saveQuoteAndEmailAction: Quote contact email:', quote?.contact?.email);
  
  if (!quote?.id) {
    console.error('saveQuoteAndEmailAction: Missing booking ID');
    return { success: false, message: 'Quote payload missing booking ID.' };
  }
  
  if (!quote?.contact?.email) {
    console.error('saveQuoteAndEmailAction: Missing contact email');
    return { success: false, message: 'Quote payload missing contact email.' };
  }
  
  try {
    console.log('saveQuoteAndEmailAction: Saving to Supabase...');
    const payload = {
      id: quote.id,
      uid: 'web', // server-side default owner; adjust if you add auth
      final_quote: quote as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('bookings').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('saveQuoteAndEmailAction: Supabase save error:', error);
      return { success: false, message: `Failed to save booking: ${error.message}` };
    }
    console.log('saveQuoteAndEmailAction: Successfully saved to Supabase');
    
      // Send the quote email (non-blocking - don't fail the save if email fails)
      // Skip if booking is cancelled or is a manual booking (manual bookings should not receive automated notifications)
      if (quote.status !== 'cancelled' && !quote.isManualBooking) {
      console.log('saveQuoteAndEmailAction: Attempting to send quote email...');
      try {
        await sendQuoteEmail(quote);
        console.log('saveQuoteAndEmailAction: Quote email sent successfully');
      } catch (emailError: any) {
        console.error('saveQuoteAndEmailAction: Failed to send quote email:', emailError);
        console.error('saveQuoteAndEmailAction: Email error details:', JSON.stringify(emailError, null, 2));
        // Continue even if email fails - booking is saved
      }
      
      // Send WhatsApp message with quote link (non-blocking - don't fail the save if WhatsApp fails)
      console.log('saveQuoteAndEmailAction: Attempting to send WhatsApp message...');
      try {
        const whatsappResult = await sendQuoteWhatsApp(quote);
        
        // Update booking with WhatsApp message status
        const updatedQuoteWithWhatsApp: FinalQuote = {
          ...quote,
          whatsappMessages: {
            ...quote.whatsappMessages,
            initial: {
              sent: whatsappResult.success,
              sentAt: whatsappResult.success ? new Date().toISOString() : undefined,
              messageSid: whatsappResult.messageSid,
              delivered: whatsappResult.delivered || false,
              deliveryStatus: whatsappResult.deliveryStatus,
              error: whatsappResult.error,
            },
          },
        };
        
        // Save updated quote with WhatsApp status
        const { error: whatsappUpdateError } = await supabaseAdmin
          .from('bookings')
          .update({ 
            final_quote: updatedQuoteWithWhatsApp as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', quote.id);
        
        if (whatsappUpdateError) {
          console.error('saveQuoteAndEmailAction: Failed to update booking with WhatsApp status:', whatsappUpdateError);
        } else {
          // Update quote reference to use the updated version with WhatsApp status
          quote = updatedQuoteWithWhatsApp;
        }
        
        if (whatsappResult.success) {
          console.log('saveQuoteAndEmailAction: WhatsApp message sent successfully, SID:', whatsappResult.messageSid);
        } else {
          console.warn('saveQuoteAndEmailAction: WhatsApp message failed:', whatsappResult.error);
          // Continue even if WhatsApp fails - booking is saved
        }
      } catch (whatsappError: any) {
        console.error('saveQuoteAndEmailAction: Failed to send WhatsApp message:', whatsappError);
        // Continue even if WhatsApp fails - booking is saved
      }
      
      // Schedule follow-up emails (non-blocking)
      // Use the created_at timestamp we just set for consistent scheduling
      console.log('saveQuoteAndEmailAction: Attempting to schedule follow-up emails...');
      try {
        const bookingCreatedAt = new Date(payload.created_at);
        await scheduleFollowUpEmails(quote, bookingCreatedAt);
        console.log('saveQuoteAndEmailAction: Follow-up emails scheduled successfully');
      } catch (scheduleError: any) {
        console.error('saveQuoteAndEmailAction: Failed to schedule follow-up emails:', scheduleError);
        // Continue even if scheduling fails
      }
      
		// Schedule WhatsApp reminders based on event date (non-blocking)
		// Always schedule reminders if they don't exist yet OR weren't scheduled (for new and existing bookings)
		console.log('saveQuoteAndEmailAction: Attempting to schedule WhatsApp reminders...');
		try {
			const { ensureWhatsAppRemindersScheduled } = await import('@/lib/whatsapp-helpers');
			const result = await ensureWhatsAppRemindersScheduled(quote);
			if (result.scheduled2w || result.scheduled1w) {
				console.log('saveQuoteAndEmailAction: WhatsApp reminders scheduled successfully');
			}
			if (result.errors.length > 0) {
				console.error('saveQuoteAndEmailAction: Some errors scheduling WhatsApp reminders:', result.errors);
			}
		} catch (whatsappScheduleError: any) {
			console.error('saveQuoteAndEmailAction: Failed to schedule WhatsApp reminders:', whatsappScheduleError);
			// Continue even if scheduling fails
		}
    } else {
      console.log('saveQuoteAndEmailAction: Skipping email and scheduling for cancelled booking');
    }
    
    console.log('saveQuoteAndEmailAction: Completed successfully');
    return { success: true, message: 'Quote saved successfully.' };
  } catch (e: any) {
    console.error('saveQuoteAndEmailAction: Unexpected error:', e);
    console.error('saveQuoteAndEmailAction: Error stack:', e?.stack);
    return { success: false, message: e?.message || 'Unknown error saving quote.' };
  }
}

// Server action to send final payment confirmation email
export async function sendFinalPaymentConfirmationEmailAction(bookingId: string): Promise<ActionResult> {
  if (!bookingId) {
    return { success: false, message: 'Booking ID is missing.' };
  }

  try {
    const bookingDoc = await getBooking(bookingId);

    if (!bookingDoc) {
      return { success: false, message: `Booking with ID ${bookingId} not found.` };
    }

    // Don't send emails for cancelled bookings
    if (bookingDoc.finalQuote.status === 'cancelled') {
      return { success: false, message: 'Cannot send emails for cancelled bookings.' };
    }

    await sendFinalPaymentConfirmationEmail(bookingDoc.finalQuote);

    return { success: true, message: 'Final payment confirmation email sent successfully.' };
  } catch (error: any) {
    console.error('Failed to send final payment confirmation email:', error);
    if (error.message.includes('Resend is not configured')) {
      return { success: false, message: 'Email server is not configured. Please check API keys.' };
    }
    return { success: false, message: 'An unknown error occurred while sending the email.' };
  }
}

// This is a server action that can be called from the client-side
// to securely trigger a confirmation email.
export async function sendConfirmationEmailAction(bookingId: string): Promise<ActionResult> {
  if (!bookingId) {
    return { success: false, message: 'Booking ID is missing.' };
  }

  try {
    const bookingDoc = await getBooking(bookingId);

    if (!bookingDoc) {
      return { success: false, message: `Booking with ID ${bookingId} not found.` };
    }
    
    // Don't send emails for cancelled bookings
    if (bookingDoc.finalQuote.status === 'cancelled') {
      return { success: false, message: 'Cannot send emails for cancelled bookings.' };
    }
    
     // We only send the email if the booking is actually confirmed.
    if (bookingDoc.finalQuote.status !== 'confirmed') {
        return { success: false, message: `This action is only for 'confirmed' bookings. This booking is currently '${bookingDoc.finalQuote.status}'.` };
    }
    
    // Ensure payment has been marked as received before sending final confirmation
    if (bookingDoc.finalQuote.paymentDetails?.status !== 'deposit-paid') {
        return { success: false, message: `This action is for bookings with a paid deposit. This booking's payment status is '${bookingDoc.finalQuote.paymentDetails?.status}'.` };
    }


    // Call the existing email function with the booking data.
    await sendQuoteEmail(bookingDoc.finalQuote);

    return { success: true, message: 'Confirmation email sent successfully.' };

  } catch (error: any) {
    console.error('Failed to send confirmation email:', error);
    // Provide more specific feedback based on the error.
    if (error.message.includes('Resend is not configured')) {
        return { success: false, message: 'Email server is not configured. Please check API keys.' };
    }
    return { success: false, message: 'An unknown error occurred while sending the email.' };
  }
}


export async function sendAdminScreenshotNotificationAction(bookingId: string): Promise<ActionResult> {
    if (!bookingId) {
        return { success: false, message: 'Booking ID is missing for admin notification.' };
    }

    try {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
            return { success: false, message: `Booking with ID ${bookingId} not found.` };
        }

        await sendAdminScreenshotNotification(bookingDoc.finalQuote);
        return { success: true, message: 'Admin notification sent.' };

    } catch (error: any) {
        console.error('Failed to send admin notification email:', error);
        return { success: false, message: error.message || 'An unknown error occurred while sending the admin notification.' };
    }
}

// Approve payment screenshot - updates status to payment-approved and sends confirmation email
export async function approvePaymentAction(bookingId: string): Promise<ActionResult> {
    if (!bookingId) {
        return { success: false, message: 'Booking ID is missing.' };
    }

    try {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
            return { success: false, message: `Booking with ID ${bookingId} not found.` };
        }

        // Update payment status to payment-approved and booking status to confirmed
        // Preserve selectedQuote if it exists, or infer from payment amount if missing
        let selectedQuote = bookingDoc.finalQuote.selectedQuote;
        if (!selectedQuote && bookingDoc.finalQuote.paymentDetails && bookingDoc.finalQuote.quotes) {
            // Infer from payment amount
            const paymentAmount = bookingDoc.finalQuote.paymentDetails.depositAmount || 0;
            if (paymentAmount > 0) {
                const leadDeposit = bookingDoc.finalQuote.quotes.lead?.total * 0.5 || 0;
                const teamDeposit = bookingDoc.finalQuote.quotes.team?.total * 0.5 || 0;
                if (Math.abs(paymentAmount - leadDeposit) < 1) {
                    selectedQuote = 'lead';
                } else if (Math.abs(paymentAmount - teamDeposit) < 1) {
                    selectedQuote = 'team';
                }
            }
        }
        
        const updatedQuote: FinalQuote = {
            ...bookingDoc.finalQuote,
            status: 'confirmed',
            selectedQuote: selectedQuote || bookingDoc.finalQuote.selectedQuote, // Preserve or set selectedQuote
            paymentDetails: {
                ...bookingDoc.finalQuote.paymentDetails!,
                status: 'payment-approved',
            },
        };

        // Fetch existing booking to preserve uid and created_at
        const { data: existingData } = await supabaseAdmin
            .from('bookings')
            .select('uid, created_at')
            .eq('id', bookingId)
            .single();

        // Save updated booking
        const getCreatedAt = () => {
            if (existingData?.created_at) return existingData.created_at;
            if (bookingDoc.createdAt) {
                // Handle both Date objects and Firestore Timestamps
                if (bookingDoc.createdAt instanceof Date) {
                    return bookingDoc.createdAt.toISOString();
                }
                if (typeof bookingDoc.createdAt === 'object' && 'toDate' in bookingDoc.createdAt) {
                    return bookingDoc.createdAt.toDate().toISOString();
                }
            }
            return new Date().toISOString();
        };

        const payload: any = {
            id: bookingId,
            final_quote: updatedQuote as any,
            updated_at: new Date().toISOString(),
            // Preserve existing uid and created_at
            uid: existingData?.uid || bookingDoc.uid || 'web',
            created_at: getCreatedAt(),
        };

        const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .upsert(payload, { onConflict: 'id' });

        if (updateError) {
            return { success: false, message: `Failed to update booking: ${updateError.message}` };
        }

        // Send confirmation email
        await sendQuoteEmail(updatedQuote);

        // Schedule event reminder email 24 hours before the event
        await scheduleEventReminder24HEmail(updatedQuote);
        
        // Schedule appointment day reminder email 2.5 hours before appointment time
        await scheduleAppointmentDayReminderEmail(updatedQuote);
        
        // Schedule post-appointment follow-up email 6 hours after appointment time
        await schedulePostAppointmentFollowupEmail(updatedQuote);

        return { success: true, message: 'Payment approved and confirmation email sent.' };

    } catch (error: any) {
        console.error('Failed to approve payment:', error);
        return { success: false, message: error.message || 'An unknown error occurred while approving payment.' };
    }
}

// Reject payment screenshot - updates status to screenshot-rejected and sends rejection email
export async function rejectScreenshotAction(bookingId: string): Promise<ActionResult> {
    if (!bookingId) {
        return { success: false, message: 'Booking ID is missing.' };
    }

    try {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
            return { success: false, message: `Booking with ID ${bookingId} not found.` };
        }

        // Update payment status to screenshot-rejected
        const updatedQuote: FinalQuote = {
            ...bookingDoc.finalQuote,
            paymentDetails: {
                ...bookingDoc.finalQuote.paymentDetails!,
                status: 'screenshot-rejected',
            },
        };

        // Fetch existing booking to preserve uid and created_at
        const { data: existingData } = await supabaseAdmin
            .from('bookings')
            .select('uid, created_at')
            .eq('id', bookingId)
            .single();

        // Save updated booking
        const getCreatedAt = () => {
            if (existingData?.created_at) return existingData.created_at;
            if (bookingDoc.createdAt) {
                // Handle both Date objects and Firestore Timestamps
                if (bookingDoc.createdAt instanceof Date) {
                    return bookingDoc.createdAt.toISOString();
                }
                if (typeof bookingDoc.createdAt === 'object' && 'toDate' in bookingDoc.createdAt) {
                    return bookingDoc.createdAt.toDate().toISOString();
                }
            }
            return new Date().toISOString();
        };

        const payload: any = {
            id: bookingId,
            final_quote: updatedQuote as any,
            updated_at: new Date().toISOString(),
            // Preserve existing uid and created_at
            uid: existingData?.uid || bookingDoc.uid || 'web',
            created_at: getCreatedAt(),
        };

        const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .upsert(payload, { onConflict: 'id' });

        if (updateError) {
            return { success: false, message: `Failed to update booking: ${updateError.message}` };
        }

        // Send rejection email
        await sendRejectionEmail(updatedQuote);

        return { success: true, message: 'Screenshot rejected and rejection email sent.' };

    } catch (error: any) {
        console.error('Failed to reject screenshot:', error);
        return { success: false, message: error.message || 'An unknown error occurred while rejecting screenshot.' };
    }
}

// Approve final payment - updates status to deposit-paid
export async function approveFinalPaymentAction(bookingId: string): Promise<ActionResult> {
    if (!bookingId) {
        return { success: false, message: 'Booking ID is missing.' };
    }

    try {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
            return { success: false, message: `Booking with ID ${bookingId} not found.` };
        }

        if (!bookingDoc.finalQuote.paymentDetails?.finalPayment) {
            return { success: false, message: 'Final payment not found for this booking.' };
        }

        // Update final payment status to deposit-paid
        const updatedQuote: FinalQuote = {
            ...bookingDoc.finalQuote,
            paymentDetails: {
                ...bookingDoc.finalQuote.paymentDetails!,
                finalPayment: {
                    ...bookingDoc.finalQuote.paymentDetails.finalPayment,
                    status: 'deposit-paid',
                },
            },
        };

        // Fetch existing booking to preserve uid and created_at
        const { data: existingData } = await supabaseAdmin
            .from('bookings')
            .select('uid, created_at')
            .eq('id', bookingId)
            .single();

        // Save updated booking
        const getCreatedAt = () => {
            if (existingData?.created_at) return existingData.created_at;
            if (bookingDoc.createdAt) {
                if (bookingDoc.createdAt instanceof Date) {
                    return bookingDoc.createdAt.toISOString();
                }
                if (typeof bookingDoc.createdAt === 'object' && 'toDate' in bookingDoc.createdAt) {
                    return bookingDoc.createdAt.toDate().toISOString();
                }
            }
            return new Date().toISOString();
        };

        const payload: any = {
            id: bookingId,
            final_quote: updatedQuote as any,
            updated_at: new Date().toISOString(),
            uid: existingData?.uid || bookingDoc.uid || 'web',
            created_at: getCreatedAt(),
        };

        const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .upsert(payload, { onConflict: 'id' });

        if (updateError) {
            return { success: false, message: `Failed to update booking: ${updateError.message}` };
        }

        // Send final payment confirmation email
        await sendFinalPaymentConfirmationEmail(updatedQuote);

        return { success: true, message: 'Final payment approved and confirmation email sent. Booking is now fully paid.' };

    } catch (error: any) {
        console.error('Failed to approve final payment:', error);
        return { success: false, message: error.message || 'An unknown error occurred while approving final payment.' };
    }
}

// Reject final payment screenshot - updates status to screenshot-rejected and sends rejection email
export async function rejectFinalPaymentAction(bookingId: string): Promise<ActionResult> {
    if (!bookingId) {
        return { success: false, message: 'Booking ID is missing.' };
    }

    try {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
            return { success: false, message: `Booking with ID ${bookingId} not found.` };
        }

        if (!bookingDoc.finalQuote.paymentDetails?.finalPayment) {
            return { success: false, message: 'Final payment not found for this booking.' };
        }

        // Update final payment status to screenshot-rejected
        const updatedQuote: FinalQuote = {
            ...bookingDoc.finalQuote,
            paymentDetails: {
                ...bookingDoc.finalQuote.paymentDetails!,
                finalPayment: {
                    ...bookingDoc.finalQuote.paymentDetails.finalPayment,
                    status: 'screenshot-rejected',
                },
            },
        };

        // Fetch existing booking to preserve uid and created_at
        const { data: existingData } = await supabaseAdmin
            .from('bookings')
            .select('uid, created_at')
            .eq('id', bookingId)
            .single();

        // Save updated booking
        const getCreatedAt = () => {
            if (existingData?.created_at) return existingData.created_at;
            if (bookingDoc.createdAt) {
                if (bookingDoc.createdAt instanceof Date) {
                    return bookingDoc.createdAt.toISOString();
                }
                if (typeof bookingDoc.createdAt === 'object' && 'toDate' in bookingDoc.createdAt) {
                    return bookingDoc.createdAt.toDate().toISOString();
                }
            }
            return new Date().toISOString();
        };

        const payload: any = {
            id: bookingId,
            final_quote: updatedQuote as any,
            updated_at: new Date().toISOString(),
            uid: existingData?.uid || bookingDoc.uid || 'web',
            created_at: getCreatedAt(),
        };

        const { error: updateError } = await supabaseAdmin
            .from('bookings')
            .upsert(payload, { onConflict: 'id' });

        if (updateError) {
            return { success: false, message: `Failed to update booking: ${updateError.message}` };
        }

        // Send rejection email for final payment
        await sendRejectionEmail(bookingDoc.finalQuote, true);

        return { success: true, message: 'Final payment screenshot rejected and rejection email sent.' };

    } catch (error: any) {
        console.error('Failed to reject final payment screenshot:', error);
        return { success: false, message: error.message || 'An unknown error occurred while rejecting final payment screenshot.' };
    }
}

// Test email actions for follow-up emails
export async function testFollowUp24HEmailAction(): Promise<ActionResult> {
  try {
    const testQuote: FinalQuote = {
      id: 'TEST-24H',
      contact: { name: 'Test User', email: 'orders@looksbyanum.com', phone: 'N/A' },
      booking: {
        days: [
          {
            date: formatToronto(new Date(), 'PPP'),
            getReadyTime: '12:00 PM',
            serviceName: 'Test Service',
            serviceOption: 'Makeup & Hair',
            serviceType: 'mobile',
            location: 'Test Location',
            addOns: ['Test Add-on'],
          },
        ],
        hasMobileService: true,
      },
      quotes: {
        lead: {
          lineItems: [{ description: 'Test Item', price: 100 }],
          subtotal: 100,
          tax: 13,
          total: 113,
        },
        team: {
          lineItems: [{ description: 'Test Item', price: 80 }],
          subtotal: 80,
          tax: 10.4,
          total: 90.4,
        },
      },
      selectedQuote: 'lead',
      status: 'quoted',
    };

    await sendFollowUp24HEmail(testQuote);
    return { success: true, message: '24-hour follow-up test email sent successfully to orders@looksbyanum.com' };
  } catch (error: any) {
    console.error('Failed to send test 24H email:', error);
    return { success: false, message: error.message || 'Failed to send test email.' };
  }
}

export async function testFollowUp3DEmailAction(): Promise<ActionResult> {
  try {
    const testQuote: FinalQuote = {
      id: 'TEST-3D',
      contact: { name: 'Test User', email: 'orders@looksbyanum.com', phone: 'N/A' },
      booking: {
        days: [
          {
            date: formatToronto(new Date(), 'PPP'),
            getReadyTime: '12:00 PM',
            serviceName: 'Test Service',
            serviceOption: 'Makeup & Hair',
            serviceType: 'mobile',
            location: 'Test Location',
            addOns: ['Test Add-on'],
          },
        ],
        hasMobileService: true,
      },
      quotes: {
        lead: {
          lineItems: [{ description: 'Test Item', price: 100 }],
          subtotal: 100,
          tax: 13,
          total: 113,
        },
        team: {
          lineItems: [{ description: 'Test Item', price: 80 }],
          subtotal: 80,
          tax: 10.4,
          total: 90.4,
        },
      },
      selectedQuote: 'lead',
      status: 'quoted',
    };

    await sendFollowUp3DEmail(testQuote);
    return { success: true, message: '3-day follow-up test email sent successfully to orders@looksbyanum.com' };
  } catch (error: any) {
    console.error('Failed to send test 3D email:', error);
    return { success: false, message: error.message || 'Failed to send test email.' };
  }
}

export async function testFollowUp6DEmailAction(): Promise<ActionResult> {
  try {
    const testQuote: FinalQuote = {
      id: 'TEST-6D',
      contact: { name: 'Test User', email: 'orders@looksbyanum.com', phone: 'N/A' },
      booking: {
        days: [
          {
            date: formatToronto(new Date(), 'PPP'),
            getReadyTime: '12:00 PM',
            serviceName: 'Test Service',
            serviceOption: 'Makeup & Hair',
            serviceType: 'mobile',
            location: 'Test Location',
            addOns: ['Test Add-on'],
          },
        ],
        hasMobileService: true,
      },
      quotes: {
        lead: {
          lineItems: [{ description: 'Test Item', price: 100 }],
          subtotal: 100,
          tax: 13,
          total: 113,
        },
        team: {
          lineItems: [{ description: 'Test Item', price: 80 }],
          subtotal: 80,
          tax: 10.4,
          total: 90.4,
        },
      },
      selectedQuote: 'lead',
      status: 'quoted',
    };

    await sendFollowUp6DEmail(testQuote);
    return { success: true, message: '6-day follow-up test email sent successfully to orders@looksbyanum.com' };
  } catch (error: any) {
    console.error('Failed to send test 6D email:', error);
    return { success: false, message: error.message || 'Failed to send test email.' };
    }
}

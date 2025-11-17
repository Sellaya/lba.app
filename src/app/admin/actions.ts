'use server';

import 'dotenv/config';
import { getBooking } from '@/firebase/server-actions';
import { sendQuoteEmail, sendAdminScreenshotNotification, sendRejectionEmail, sendFinalPaymentConfirmationEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase/server';
import { scheduleFollowUpEmails, scheduleEventReminder24HEmail } from '@/lib/scheduled-emails';
import type { FinalQuote } from '@/lib/types';


type ActionResult = {
  success: boolean;
  message: string;
};

// Save a newly generated quote to Supabase and send the quote email (server-side, uses service role)
export async function saveQuoteAndEmailAction(quote: FinalQuote): Promise<ActionResult> {
  if (!quote?.id) {
    return { success: false, message: 'Quote payload missing booking ID.' };
  }
  try {
    const payload = {
      id: quote.id,
      uid: 'web', // server-side default owner; adjust if you add auth
      final_quote: quote as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('bookings').upsert(payload, { onConflict: 'id' });
    if (error) {
      return { success: false, message: `Failed to save booking: ${error.message}` };
    }
    // Send the quote email (formatted link to /book/{id})
    await sendQuoteEmail(quote);
    
    // Schedule follow-up emails (3H, 6H, and 24H if mobile)
    await scheduleFollowUpEmails(quote);
    
    return { success: true, message: 'Quote saved and email sent.' };
  } catch (e: any) {
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
        const updatedQuote: FinalQuote = {
            ...bookingDoc.finalQuote,
            status: 'confirmed',
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

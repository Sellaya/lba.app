'use server';
import 'dotenv/config';

import { Resend } from 'resend';
import type { FinalQuote } from './types';
import QuoteEmailTemplate from '@/app/emails/quote-email';
import FollowUpEmailTemplate from '@/app/emails/follow-up-email';
import FollowUp3HEmailTemplate from '@/app/emails/follow-up-3h-email';
import FollowUp6HEmailTemplate from '@/app/emails/follow-up-6h-email';
import FollowUp24HEmailTemplate from '@/app/emails/follow-up-24h-email';
import FollowUp3DEmailTemplate from '@/app/emails/follow-up-3d-email';
import FollowUp6DEmailTemplate from '@/app/emails/follow-up-6d-email';
import FollowUp30DEmailTemplate from '@/app/emails/follow-up-30d-email';
import EventReminder24HEmailTemplate from '@/app/emails/event-reminder-24h-email';
import AppointmentDayReminderEmailTemplate from '@/app/emails/appointment-day-reminder-email';
import PostAppointmentFollowupEmailTemplate from '@/app/emails/post-appointment-followup-email';
import AdminNotificationEmailTemplate from '@/app/emails/admin-notification-email';
import RejectionEmailTemplate from '@/app/emails/rejection-email';
import BookCallAdminEmailTemplate from '@/app/emails/book-call-admin-email';
import BookCallConfirmationEmailTemplate from '@/app/emails/book-call-confirmation-email';
import FinalPaymentConfirmationEmailTemplate from '@/app/emails/final-payment-confirmation-email';
import ArtistBookingEmailTemplate from '@/app/emails/artist-booking-email';
import PasswordResetEmailTemplate from '@/app/emails/password-reset-email';
import { getBaseUrl } from './base-url';

const getResend = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith('re_') === false || apiKey.length < 20) {
        console.error('A valid Resend API key is not configured. Email functionality is disabled.');
        // Return null to indicate that Resend is not configured.
        return null;
    }
    return new Resend(apiKey);
}

// Helper function to get the from email
// Always uses the verified custom domain (looksbyanum.com is verified in Resend)
// The verified domain is the primary and only domain used for sending emails
const getFromEmail = (preferredEmail: string): string => {
    // Always use the verified custom domain (orders@looksbyanum.com)
    // The domain looksbyanum.com is verified in Resend and should be used
    // Format with display name "Looks by Anum" while keeping email address the same
    return `Looks by Anum <${preferredEmail}>`;
}

// Helper function to get the from email for admin notifications
// Uses format "LBA-ORDER #orderID" as the sender name
const getAdminFromEmail = (preferredEmail: string, orderId: string): string => {
    return `LBA-ORDER #${orderId} <${preferredEmail}>`;
}

// Helper function to handle authorization errors from Resend
const handleResendAuthError = (error: any, fromEmail: string, preferredEmail: string, emailType: string = 'email'): never => {
    // Log full error details for debugging
    const errorMessage = error?.message || JSON.stringify(error);
    const errorCode = error?.name || error?.code || 'UNKNOWN';
    
    console.error('Resend Error Details:', {
        message: errorMessage,
        code: errorCode,
        fromEmail: fromEmail,
        preferredEmail: preferredEmail,
        fullError: error
    });
    
    const isAuthError = errorMessage?.toLowerCase().includes('not authorized') || 
                       errorMessage?.toLowerCase().includes('unauthorized') ||
                       errorMessage?.toLowerCase().includes('domain') ||
                       errorCode === 'unauthorized' ||
                       errorCode === 'forbidden';
    
    if (isAuthError) {
        const domain = preferredEmail.split('@')[1];
        // Provide more specific troubleshooting steps
        throw new Error(
            `Failed to send ${emailType}: Domain "${domain}" authorization error. ` +
            `Error: ${errorMessage}. ` +
            `Troubleshooting: 1) Verify the domain "${domain}" is verified in your Resend dashboard at https://resend.com/domains. ` +
            `2) Ensure your API key (${process.env.RESEND_API_KEY?.substring(0, 10)}...) belongs to the same Resend workspace/account where the domain is verified. ` +
            `3) Check that the email address "${preferredEmail}" is allowed for the domain "${domain}". ` +
            `4) Verify SPF, DKIM, and DMARC DNS records are correctly configured.`
        );
    }
    
    throw new Error(`Failed to send ${emailType}: ${errorMessage || 'Unknown error'}`);
}


export async function sendQuoteEmail(quote: FinalQuote) {
  console.log('sendQuoteEmail: Starting for booking ID:', quote.id);
  console.log('sendQuoteEmail: Contact email:', quote.contact?.email);
  
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendQuoteEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('sendQuoteEmail: Resend not configured; skipping sendQuoteEmail for booking ID:', quote.id);
    console.warn('sendQuoteEmail: RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    return;
  }
    
  const clientSubject = quote.status === 'confirmed' 
    ? `Booking Confirmed! - Looks by Anum (ID: ${quote.id})`
    : `Your Makeup Quote from Looks by Anum (ID: ${quote.id})`;

  const adminEmail = "orders@looksbyanum.com";
  const preferredFromEmail = 'orders@looksbyanum.com';
  const fromEmail = getFromEmail(preferredFromEmail);
  
  console.log('sendQuoteEmail: From email:', fromEmail);
  console.log('sendQuoteEmail: To email:', quote.contact.email);
  console.log('sendQuoteEmail: Subject:', clientSubject);
    
  // Always send the email to the client
  // Using just the email address (no display name) to avoid potential Resend authorization issues
  console.log('sendQuoteEmail: Sending client email...');
  const clientEmailPromise = resend.emails.send({
    from: fromEmail,
    to: [quote.contact.email],
    subject: clientSubject,
    react: QuoteEmailTemplate({ quote, baseUrl }),
  });

  const emailPromises = [clientEmailPromise];

  // Only send the email to the admin if the booking is confirmed
  if (quote.status === 'confirmed') {
    const adminSubject = `Booking Confirmed - ${quote.contact.name} (ID: ${quote.id})`;
    const adminFromEmail = getAdminFromEmail('orders@looksbyanum.com', quote.id);
    const adminEmailPromise = resend.emails.send({
        from: adminFromEmail,
        to: [adminEmail],
        subject: adminSubject,
        react: QuoteEmailTemplate({ quote, baseUrl }),
    });
    emailPromises.push(adminEmailPromise);
  }
  
  console.log('sendQuoteEmail: Waiting for email results...');
  const [clientEmailResult, adminEmailResult] = await Promise.all(emailPromises);

  if (clientEmailResult.error) {
    console.error('sendQuoteEmail: Client email sending error:', JSON.stringify(clientEmailResult.error, null, 2));
    console.error('sendQuoteEmail: From email used:', fromEmail);
    console.error('sendQuoteEmail: Resend API key configured:', process.env.RESEND_API_KEY ? 'Yes' : 'No');
    console.error('sendQuoteEmail: API key prefix:', process.env.RESEND_API_KEY?.substring(0, 10) || 'N/A');
    // Log the error but don't throw - allow the booking to save even if email fails
    const errorMessage = clientEmailResult.error?.message || JSON.stringify(clientEmailResult.error);
    console.error(`sendQuoteEmail: Failed to send client email to ${quote.contact.email}:`, errorMessage);
    // DO NOT throw - just log and return silently
    // The booking will still be saved even if email fails
    return; // Exit gracefully without throwing
  } else {
    console.log('sendQuoteEmail: Client email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    console.log('sendQuoteEmail: Email ID:', clientEmailResult.data?.id);
  }
  
  if (adminEmailResult && adminEmailResult.error) {
      console.error('Admin email sending error:', adminEmailResult.error);
      // Log admin email errors but don't throw - admin notification failure shouldn't block client email
      const errorMessage = adminEmailResult.error?.message || JSON.stringify(adminEmailResult.error);
      console.error(`Failed to send admin notification email:`, errorMessage);
  } else if (adminEmailResult) {
      console.log('Admin notification email sent successfully for booking ID:', quote.id, 'to:', adminEmail);
  }
}


export async function sendFollowUpEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUpEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFollowUpEmail for booking ID:', quote.id);
    return;
  }

  const subject = `Your Makeup Quote from Looks by Anum is Waiting!`;
  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: subject,
      react: FollowUpEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up email sending error:', error);
      throw new Error(`Failed to send follow-up email: ${error.message}`);
    }

    console.log('Follow-up email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUpEmail:', error.message);
    throw error; // Re-throw to be caught by the server action
  }
}

export async function sendAdminScreenshotNotification(quote: FinalQuote) {
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendAdminScreenshotNotification for booking ID:', quote.id);
    return;
  }

  const adminEmail = "orders@looksbyanum.com";
  const adminFromEmail = getAdminFromEmail('orders@looksbyanum.com', quote.id);

  // Determine if this is for final payment or advance payment
  const isFinalPayment = quote.paymentDetails?.finalPayment?.status === 'deposit-pending' && quote.paymentDetails?.finalPayment?.screenshotUrl;
  const paymentType = isFinalPayment ? 'Final Payment' : 'Advance Payment';

  try {
    const { data, error } = await resend.emails.send({
      from: adminFromEmail,
      to: [adminEmail],
      subject: `${paymentType} E-Transfer Submitted for Booking #${quote.id}`,
      react: AdminNotificationEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Admin notification email sending error:', error);
      throw new Error(`Failed to send admin notification email: ${error.message}`);
    }

    console.log('Admin notification email sent successfully for booking ID:', quote.id);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendAdminScreenshotNotification:', error.message);
    throw error;
  }
}

export async function sendRejectionEmail(quote: FinalQuote, isFinalPayment: boolean = false) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendRejectionEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendRejectionEmail for booking ID:', quote.id);
    return;
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `${isFinalPayment ? 'Final ' : ''}Payment Screenshot Rejected - Booking #${quote.id}`,
      react: RejectionEmailTemplate({ quote, baseUrl, isFinalPayment }),
    });

    if (error) {
      console.error('Rejection email sending error:', error);
      throw new Error(`Failed to send rejection email: ${error.message}`);
    }

    console.log('Rejection email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendRejectionEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp3HEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp3HEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 3H email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Just Checking In - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp3HEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 3H email sending error:', error);
      throw new Error(`Failed to send follow-up 3H email: ${error.message}`);
    }

    console.log('Follow-up 3H email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp3HEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp6HEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp6HEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 6H email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Secure Your Spot – Spots Fill Up Fast! - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp6HEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 6H email sending error:', error);
      throw new Error(`Failed to send follow-up 6H email: ${error.message}`);
    }

    console.log('Follow-up 6H email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp6HEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp24HEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp24HEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 24H email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Following Up on Your Quote - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp24HEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 24H email sending error:', error);
      throw new Error(`Failed to send follow-up 24H email: ${error.message}`);
    }

    console.log('Follow-up 24H email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp24HEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp3DEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp3DEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 3D email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Don't Miss Out on Your Perfect Look - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp3DEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 3D email sending error:', error);
      throw new Error(`Failed to send follow-up 3D email: ${error.message}`);
    }

    console.log('Follow-up 3D email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp3DEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp6DEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp6DEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 6D email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `🎉 Special Offer: 5% Off Your Booking - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp6DEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 6D email sending error:', error);
      throw new Error(`Failed to send follow-up 6D email: ${error.message}`);
    }

    console.log('Follow-up 6D email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp6DEmail:', error.message);
    throw error;
  }
}

export async function sendFollowUp30DEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFollowUp30DEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send follow-up 30D email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Final Opportunity to Book Your Perfect Look - Looks by Anum (ID: ${quote.id})`,
      react: FollowUp30DEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Follow-up 30D email sending error:', error);
      throw new Error(`Failed to send follow-up 30D email: ${error.message}`);
    }

    console.log('Follow-up 30D email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendFollowUp30DEmail:', error.message);
    throw error;
  }
}

export async function sendEventReminder24HEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendEventReminder24HEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send event reminder 24H email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0 || !quote.booking.days[0]) {
    console.error('Cannot send event reminder email - no booking days found for booking ID:', quote.id);
    throw new Error('Booking has no service days');
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');
  const firstDay = quote.booking.days[0];

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Your Event is Tomorrow! ✨ Reminder for ${firstDay.date || 'your event'} (ID: ${quote.id})`,
      react: EventReminder24HEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Event reminder 24H email sending error:', error);
      throw new Error(`Failed to send event reminder 24H email: ${error.message}`);
    }

    console.log('Event reminder 24H email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendEventReminder24HEmail:', error.message);
    throw error;
  }
}

export async function sendAppointmentDayReminderEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendAppointmentDayReminderEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send appointment day reminder email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0 || !quote.booking.days[0]) {
    console.error('Cannot send appointment day reminder email - no booking days found for booking ID:', quote.id);
    throw new Error('Booking has no service days');
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');
  const firstDay = quote.booking.days[0];

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `Your Appointment is Today! ✨ Reminder for ${firstDay.date || 'your appointment'} (ID: ${quote.id})`,
      react: AppointmentDayReminderEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Appointment day reminder email sending error:', error);
      throw new Error(`Failed to send appointment day reminder email: ${error.message}`);
    }

    console.log('Appointment day reminder email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendAppointmentDayReminderEmail:', error.message);
    throw error;
  }
}

// Send post-appointment follow-up email asking for photos
export async function sendPostAppointmentFollowupEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendPostAppointmentFollowupEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    const errorMsg = `Resend not configured; cannot send post-appointment follow-up email for booking ID: ${quote.id}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: `We'd Love to See Your Photos! 📸 Looks by Anum (ID: ${quote.id})`,
      react: PostAppointmentFollowupEmailTemplate({ quote, baseUrl }),
    });

    if (error) {
      console.error('Post-appointment follow-up email sending error:', error);
      throw new Error(`Failed to send post-appointment follow-up email: ${error.message}`);
    }

    console.log('Post-appointment follow-up email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    return data;
    
  } catch (error: any) {
    console.error('Error in sendPostAppointmentFollowupEmail:', error.message);
    throw error;
  }
}

export async function sendBookCallEmails(data: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsappNumber: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
  bookingId: string;
}) {
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendBookCallEmails');
    return;
  }

  const adminEmail = 'orders@looksbyanum.com';
  const adminFromEmail = getAdminFromEmail('orders@looksbyanum.com', data.bookingId);
  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const baseUrl = getBaseUrl();
    const quoteLink = `${baseUrl}/book/${data.bookingId}`;

    // Send to admin
    const { error: adminError } = await resend.emails.send({
      from: adminFromEmail,
      to: [adminEmail],
      subject: `New Call Booking Request from ${data.customerName} (ID: ${data.bookingId})`,
      react: BookCallAdminEmailTemplate({ ...data, quoteLink }),
    });

    if (adminError) {
      console.error('Book call admin email sending error:', adminError);
      throw new Error(`Failed to send admin email: ${adminError.message}`);
    }

    // Send confirmation to customer
    const { error: customerError } = await resend.emails.send({
      from: fromEmail,
      to: [data.customerEmail],
      subject: `Call Booking Confirmed - Looks by Anum`,
      react: BookCallConfirmationEmailTemplate({
        customerName: data.customerName,
        preferredDate: data.preferredDate,
        preferredTime: data.preferredTime,
        message: data.message,
      }),
    });

    if (customerError) {
      console.error('Book call confirmation email sending error:', customerError);
      // Don't throw - admin email was sent successfully
      console.warn('Customer confirmation email failed, but admin was notified');
    }

    console.log('Book call emails sent successfully for booking ID:', data.bookingId);
    return { success: true };
    
  } catch (error: any) {
    console.error('Error in sendBookCallEmails:', error.message);
    throw error;
  }
}

// Send final payment confirmation email
export async function sendFinalPaymentConfirmationEmail(quote: FinalQuote) {
  // Don't send emails for cancelled bookings
  if (quote.status === 'cancelled') {
    console.log(`sendFinalPaymentConfirmationEmail: Skipping email for cancelled booking ${quote.id}`);
    return;
  }
  
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFinalPaymentConfirmationEmail for booking ID:', quote.id);
    return;
  }

  const subject = `Payment Complete – Thank You! ✨ Looks by Anum (ID: ${quote.id})`;
  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: [quote.contact.email],
      subject: subject,
      react: FinalPaymentConfirmationEmailTemplate({ quote, baseUrl }),
    });

    if (result.error) {
      console.error('Final payment confirmation email sending error:', result.error);
      throw new Error(`Failed to send final payment confirmation email: ${result.error.message}`);
    } else {
      console.log('Final payment confirmation email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
    }
  } catch (error: any) {
    console.error('Error sending final payment confirmation email:', error);
    throw error;
  }
}

// Send booking details to makeup artist (without pricing)
export async function sendArtistBookingEmail(
  quote: FinalQuote, 
  artistEmail: string, 
  artistName: string,
  calendarLinks?: {
    google: string;
    outlook: string;
    yahoo: string;
    ics: string;
  }
) {
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendArtistBookingEmail for booking ID:', quote.id);
    return;
  }

  const subject = `New Booking Assignment - ${quote.contact.name} (ID: ${quote.id})`;
  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: [artistEmail],
      subject: subject,
      react: ArtistBookingEmailTemplate({ quote, artistName, baseUrl, calendarLinks }),
    });

    if (result.error) {
      console.error('Artist booking email sending error:', result.error);
      throw new Error(`Failed to send artist booking email: ${result.error.message}`);
    } else {
      console.log('Artist booking email sent successfully for booking ID:', quote.id, 'to:', artistEmail);
    }
  } catch (error: any) {
    console.error('Error sending artist booking email:', error);
    throw error;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendPasswordResetEmail');
    return;
  }

  const subject = 'Password Reset Request - Looks by Anum Admin';
  const fromEmail = getFromEmail('orders@looksbyanum.com');

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: subject,
      react: PasswordResetEmailTemplate({ resetLink }),
    });

    if (result.error) {
      console.error('Password reset email sending error:', result.error);
      throw new Error(`Failed to send password reset email: ${result.error.message}`);
    }

    console.log('Password reset email sent successfully to:', email);
    return result.data;
    
  } catch (error: any) {
    console.error('Error in sendPasswordResetEmail:', error.message);
    throw error;
  }
}

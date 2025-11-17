'use server';
import 'dotenv/config';

import { Resend } from 'resend';
import type { FinalQuote } from './types';
import QuoteEmailTemplate from '@/app/emails/quote-email';
import FollowUpEmailTemplate from '@/app/emails/follow-up-email';
import FollowUp3HEmailTemplate from '@/app/emails/follow-up-3h-email';
import FollowUp6HEmailTemplate from '@/app/emails/follow-up-6h-email';
import FollowUp24HEmailTemplate from '@/app/emails/follow-up-24h-email';
import EventReminder24HEmailTemplate from '@/app/emails/event-reminder-24h-email';
import AdminNotificationEmailTemplate from '@/app/emails/admin-notification-email';
import RejectionEmailTemplate from '@/app/emails/rejection-email';
import BookCallAdminEmailTemplate from '@/app/emails/book-call-admin-email';
import BookCallConfirmationEmailTemplate from '@/app/emails/book-call-confirmation-email';
import FinalPaymentConfirmationEmailTemplate from '@/app/emails/final-payment-confirmation-email';
import ArtistBookingEmailTemplate from '@/app/emails/artist-booking-email';
import PasswordResetEmailTemplate from '@/app/emails/password-reset-email';


const getBaseUrl = () => {
    return process.env.NODE_ENV === 'development' 
        ? (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
        : (process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.web.app`);
}

const getResend = () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith('re_') === false || apiKey.length < 20) {
        console.error('A valid Resend API key is not configured. Email functionality is disabled.');
        // Return null to indicate that Resend is not configured.
        return null;
    }
    return new Resend(apiKey);
}


export async function sendQuoteEmail(quote: FinalQuote) {
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendQuoteEmail for booking ID:', quote.id);
    return;
  }
    
  const clientSubject = quote.status === 'confirmed' 
    ? `Booking Confirmed! - Looks by Anum (ID: ${quote.id})`
    : `Your Makeup Quote from Looks by Anum (ID: ${quote.id})`;

  const adminEmail = "sellayadigital@gmail.com";
  const fromEmail = 'booking@sellaya.ca';
    
  // Always send the email to the client
  const clientEmailPromise = resend.emails.send({
    from: `Looks by Anum <${fromEmail}>`,
    to: [quote.contact.email],
    subject: clientSubject,
    react: QuoteEmailTemplate({ quote, baseUrl }),
  });

  const emailPromises = [clientEmailPromise];

  // Only send the email to the admin if the booking is confirmed
  if (quote.status === 'confirmed') {
    const adminSubject = `[ADMIN] Booking Confirmed - ${quote.contact.name} (ID: ${quote.id})`;
    const adminEmailPromise = resend.emails.send({
        from: `Looks by Anum Admin <${fromEmail}>`,
        to: [adminEmail],
        subject: adminSubject,
        react: QuoteEmailTemplate({ quote, baseUrl }),
    });
    emailPromises.push(adminEmailPromise);
  }
  
  const [clientEmailResult, adminEmailResult] = await Promise.all(emailPromises);

  if (clientEmailResult.error) {
    console.error('Client email sending error:', clientEmailResult.error);
    throw new Error(`Failed to send client email: ${clientEmailResult.error.message}`);
  } else {
    console.log('Client email sent successfully for booking ID:', quote.id, 'to:', quote.contact.email);
  }
  
  if (adminEmailResult && adminEmailResult.error) {
      console.error('Admin email sending error:', adminEmailResult.error);
      throw new Error(`Failed to send admin notification: ${adminEmailResult.error.message}`);
  } else if (adminEmailResult) {
      console.log('Admin notification email sent successfully for booking ID:', quote.id, 'to:', adminEmail);
  }
}


export async function sendFollowUpEmail(quote: FinalQuote) {
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFollowUpEmail for booking ID:', quote.id);
    return;
  }

  const subject = `Your Makeup Quote from Looks by Anum is Waiting!`;
  const fromEmail = 'booking@sellaya.ca';

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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

  const adminEmail = "sellayadigital@gmail.com";
  const fromEmail = 'booking@sellaya.ca';

  // Determine if this is for final payment or advance payment
  const isFinalPayment = quote.paymentDetails?.finalPayment?.status === 'deposit-pending' && quote.paymentDetails?.finalPayment?.screenshotUrl;
  const paymentType = isFinalPayment ? 'Final Payment' : 'Advance Payment';

  try {
    const { data, error } = await resend.emails.send({
      from: `GlamBook Pro Admin <${fromEmail}>`,
      to: [adminEmail],
      subject: `[ACTION REQUIRED] ${paymentType} E-Transfer Submitted for Booking #${quote.id}`,
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
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendRejectionEmail for booking ID:', quote.id);
    return;
  }

  const fromEmail = 'booking@sellaya.ca';

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFollowUp3HEmail for booking ID:', quote.id);
    return;
  }

  const fromEmail = 'booking@sellaya.ca';

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
      to: [quote.contact.email],
      subject: `Just Checking In - Your Makeup Quote (ID: ${quote.id})`,
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
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFollowUp6HEmail for booking ID:', quote.id);
    return;
  }

  const fromEmail = 'booking@sellaya.ca';

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
      to: [quote.contact.email],
      subject: `Secure Your Spot - Spots Fill Up Fast! (ID: ${quote.id})`,
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
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFollowUp24HEmail for booking ID:', quote.id);
    return;
  }

  // Only send for mobile bookings
  const hasMobileService = quote.booking.days.some(d => d.serviceType === 'mobile');
  if (!hasMobileService) {
    console.log('Skipping 24H email - not a mobile booking for booking ID:', quote.id);
    return;
  }

  const fromEmail = 'booking@sellaya.ca';

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
      to: [quote.contact.email],
      subject: `🎉 Limited-Time Offer: Travel Fee Waived! (ID: ${quote.id})`,
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

export async function sendEventReminder24HEmail(quote: FinalQuote) {
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendEventReminder24HEmail for booking ID:', quote.id);
    return;
  }

  // Validate booking days exist
  if (!quote.booking.days || quote.booking.days.length === 0 || !quote.booking.days[0]) {
    console.error('Cannot send event reminder email - no booking days found for booking ID:', quote.id);
    throw new Error('Booking has no service days');
  }

  const fromEmail = 'booking@sellaya.ca';
  const firstDay = quote.booking.days[0];

  try {
    const { data, error } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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

  const adminEmail = 'sellayadigital@gmail.com';
  const fromEmail = 'booking@sellaya.ca';

  try {
    const baseUrl = getBaseUrl();
    const quoteLink = `${baseUrl}/book/${data.bookingId}`;

    // Send to admin
    const { error: adminError } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
      to: [adminEmail],
      subject: `📞 New Call Booking Request from ${data.customerName} (ID: ${data.bookingId})`,
      react: BookCallAdminEmailTemplate({ ...data, quoteLink }),
    });

    if (adminError) {
      console.error('Book call admin email sending error:', adminError);
      throw new Error(`Failed to send admin email: ${adminError.message}`);
    }

    // Send confirmation to customer
    const { error: customerError } = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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
  const baseUrl = getBaseUrl();
  const resend = getResend();
  
  if (!resend) {
    console.warn('Resend not configured; skipping sendFinalPaymentConfirmationEmail for booking ID:', quote.id);
    return;
  }

  const subject = `Payment Complete – Thank You! ✨ Looks by Anum (ID: ${quote.id})`;
  const fromEmail = 'booking@sellaya.ca';

  try {
    const result = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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
  const fromEmail = 'booking@sellaya.ca';

  try {
    const result = await resend.emails.send({
      from: `Looks by Anum <${fromEmail}>`,
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
  const fromEmail = 'booking@sellaya.ca';

  try {
    const result = await resend.emails.send({
      from: `Looks by Anum Admin <${fromEmail}>`,
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

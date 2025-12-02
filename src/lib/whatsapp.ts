'use server';

import 'dotenv/config';
import twilio from 'twilio';
import { supabaseAdmin } from './supabase/server';
import type { FinalQuote } from './types';

/**
 * Format phone number to E.164 format for Twilio
 * Converts formats like (416) 555-1234 or 416-555-1234 to +14165551234
 */
function formatPhoneToE164(phone: string): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 0) return null;
  
  // If it starts with 1 and has 11 digits, it's already in the right format
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  
  // If it has 10 digits, assume it's a US/Canada number and prepend +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If it already starts with +, return as is (assuming it's already formatted)
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // If we can't determine the format, return null
  return null;
}

/**
 * Send WhatsApp message via Twilio
 *
 * If TWILIO_WHATSAPP_TEMPLATE_SID is configured and opts.useTemplate is true,
 * this will use Twilio's Content Template (contentSid + contentVariables).
 * Otherwise it falls back to a plain text body send.
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string,
  opts?: {
    useTemplate?: boolean;
    templateVariables?: Record<string, string>;
    templateSid?: string; // Optional: custom template SID (overrides env var)
  }
): Promise<{ success: boolean; error?: string; messageSid?: string; delivered?: boolean; deliveryStatus?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // Use Messaging Service SID only if explicitly configured in the environment.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+16477990213';
  // Use provided template SID from opts, env, or default to the one you shared
  const templateSid = opts?.templateSid || process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'HXcbb126555332bf7bd860d3bc5aeb32fd';

  console.log('[WhatsApp] sendWhatsAppMessage called with:', {
    to: to?.substring(0, 10) + '...',
    messageLength: message?.length,
    hasAccountSid: !!accountSid,
    hasAuthToken: !!authToken,
    hasMessagingServiceSid: !!messagingServiceSid,
    hasFromNumber: !!fromNumber,
    fromNumber,
    useTemplate: !!opts?.useTemplate,
    hasTemplateSid: !!templateSid,
  });

  if (!accountSid || !authToken) {
    console.error('[WhatsApp] Twilio credentials not configured:', {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasMessagingServiceSid: !!messagingServiceSid,
      hasFromNumber: !!fromNumber,
    });
    return {
      success: false,
      error: 'Twilio credentials not configured',
    };
  }

  try {
    // Initialize Twilio client (timeout is handled by Promise.race wrapper in webhook)
    const client = twilio(accountSid, authToken);
    
    // Format the 'to' number to E.164 format with whatsapp: prefix
    const formattedTo = formatPhoneToE164(to);
    console.log('[WhatsApp] Phone number formatting:', {
      original: to,
      formatted: formattedTo,
    });
    
    if (!formattedTo) {
      console.error('[WhatsApp] Invalid phone number format:', to);
      return {
        success: false,
        error: `Invalid phone number format: ${to}`,
      };
    }
    
    // Twilio WhatsApp requires 'whatsapp:' prefix
    const whatsappTo = `whatsapp:${formattedTo}`;
    
    // Build message options – use Content Template when requested and available
    const messageOptions: any = {
      to: whatsappTo,
    };

    if (opts?.useTemplate && templateSid) {
      messageOptions.contentSid = templateSid;
      if (opts.templateVariables) {
        messageOptions.contentVariables = JSON.stringify(opts.templateVariables);
      }
      console.log('[WhatsApp] Using content template for send:', {
        contentSid: templateSid,
        to: whatsappTo,
        hasVariables: !!opts.templateVariables,
      });
    } else {
      messageOptions.body = message;
    }

    if (messagingServiceSid) {
      messageOptions.messagingServiceSid = messagingServiceSid;
      console.log('[WhatsApp] Using messagingServiceSid for send:', {
        messagingServiceSid,
        to: whatsappTo,
      });
    } else {
      // Handle fromNumber - it might already have whatsapp: prefix or just be a number
      let whatsappFrom: string;
      if (fromNumber.startsWith('whatsapp:')) {
        whatsappFrom = fromNumber;
      } else if (fromNumber.startsWith('+')) {
        whatsappFrom = `whatsapp:${fromNumber}`;
      } else {
        // If it's just a number, add + and whatsapp: prefix
        whatsappFrom = `whatsapp:+${fromNumber.replace(/[^0-9]/g, '')}`;
      }
      messageOptions.from = whatsappFrom;
      console.log('[WhatsApp] Using from number for send:', {
        from: whatsappFrom,
        to: whatsappTo,
      });
    }

    console.log('[WhatsApp] Sending message via Twilio with options:', {
      hasMessagingServiceSid: !!messageOptions.messagingServiceSid,
      hasFrom: !!messageOptions.from,
      hasContentSid: !!messageOptions.contentSid,
      to: messageOptions.to,
      messageLength: message.length,
    });

    const messageResult = await client.messages.create(messageOptions);

    console.log('[WhatsApp] Message sent successfully:', {
      messageSid: messageResult.sid,
      to: whatsappTo,
      status: messageResult.status,
    });

    // Check delivery status
    const delivered = messageResult.status === 'delivered';
    const deliveryStatus = messageResult.status;

    return {
      success: true,
      messageSid: messageResult.sid,
      delivered,
      deliveryStatus,
    };
  } catch (error: any) {
    console.error('[WhatsApp] Error sending message:', {
      error: error?.message,
      code: error?.code,
      status: error?.status,
      moreInfo: error?.moreInfo,
      fullError: JSON.stringify(error, null, 2),
    });
    return {
      success: false,
      error: error?.message || 'Unknown error sending WhatsApp message',
    };
  }
}

/**
 * Send quote link via WhatsApp to customer
 */
export async function sendQuoteWhatsApp(quote: FinalQuote): Promise<{
  success: boolean;
  error?: string;
  messageSid?: string;
  delivered?: boolean;
  deliveryStatus?: string;
}> {
  console.log('[WhatsApp] sendQuoteWhatsApp called for quote:', quote.id);
  const phone = quote.contact.phone;
  
  console.log('[WhatsApp] Quote contact info:', {
    name: quote.contact.name,
    phone: phone,
    hasPhone: !!phone,
  });
  
  if (!phone) {
    console.warn('[WhatsApp] No phone number provided for WhatsApp send');
    return {
      success: false,
      error: 'No phone number provided',
    };
  }

  // Get base URL - use environment variable or default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.looksbyanum.com');
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  const bookCallLink = `${baseUrl}/book/${quote.id}#book-call`;
  
  // Message aligned with approved WhatsApp template (SID: HX33b5d0ade0d7b12d6ec8a1f863051c30):
  // Template variables:
  // {{1}} = Customer name
  // {{2}} = Book call link
  // {{3}} = Quote link
  const message = `Hi ${quote.contact.name}, it's Anum 😊

I just finished preparing your custom quote — and I'm so excited about your vision! ✨💕

Before you check the pricing, here are a few recent looks that match your style: @looksbyanum 💄📸

With 10+ years in the industry, I know clients often have questions about timing, makeup longevity, skin type, or bridal styling — so I'd love to hop on a quick 10-minute call to go over any concerns and make sure everything feels perfect for you. 🎀✨

Based on our current bookings, I only have a few spots remaining for your week. ⏳💗

Can we grab a quick 10 minutes this week? 😊

📞 Book your call: ${bookCallLink}

And just so you know — this quote has been fully customized for you and saved here, so you can access it anytime. 💌

Your custom quote: ${quoteLink}

Can't wait to make you feel absolutely stunning! 💍✨

Anum

Looks by Anum

📍 Toronto & GTA`;

  const result = await sendWhatsAppMessage(phone, message, {
    useTemplate: true,
    templateSid: 'HX33b5d0ade0d7b12d6ec8a1f863051c30',
    templateVariables: {
      '1': quote.contact.name,
      '2': bookCallLink,
      '3': quoteLink,
    },
  });
  return {
    success: result.success,
    error: result.error,
    messageSid: result.messageSid,
    delivered: result.delivered,
    deliveryStatus: result.deliveryStatus,
  };
}

/**
 * Send 7-day follow-up WhatsApp message
 * Only sends if booking is still in 'quoted' status and no payment has been made
 */
export async function sendFollowUp7DWhatsApp(quote: FinalQuote): Promise<{
  success: boolean;
  error?: string;
  messageSid?: string;
  delivered?: boolean;
  deliveryStatus?: string;
}> {
  console.log('[WhatsApp] sendFollowUp7DWhatsApp called for quote:', quote.id);
  
  // Only send if booking is still quoted (not confirmed or cancelled)
  if (quote.status !== 'quoted') {
    console.log(`[WhatsApp] Skipping 7-day follow-up for booking ${quote.id} - status is ${quote.status}, not 'quoted'`);
    return {
      success: false,
      error: `Booking status is ${quote.status}, not 'quoted'`,
    };
  }
  
  // Only send if advance payment has NOT been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 7-day follow-up for booking ${quote.id} - advance payment already made`);
    return {
      success: false,
      error: 'Advance payment already made',
    };
  }
  
  const phone = quote.contact.phone;
  
  if (!phone) {
    console.warn('[WhatsApp] No phone number provided for 7-day follow-up');
    return {
      success: false,
      error: 'No phone number provided',
    };
  }

  // Get base URL - use environment variable or default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.looksbyanum.com');
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  const bookCallLink = `${baseUrl}/book/${quote.id}#book-call`;
  
  // Create follow-up message
  const message = `Hi ${quote.contact.name}! 👋

We wanted to check in about your quote from Looks by Anum.

We'd love to help make your special day perfect! ✨

📋 *View Your Quote & Complete Booking*
${quoteLink}

💬 *Book a Call with Anum*
Have questions? Book a consultation call to discuss your booking:
${bookCallLink}

❓ *Need Help?*
Reply to this message and we'll assist you right away!

- Looks by Anum Team`;

  const result = await sendWhatsAppMessage(phone, message);
  return {
    success: result.success,
    error: result.error,
    messageSid: result.messageSid,
    delivered: result.delivered,
    deliveryStatus: result.deliveryStatus,
  };
}

/**
 * Schedule 7-day WhatsApp follow-up message
 * Only schedules if booking is still in 'quoted' status and no payment has been made
 */
export async function scheduleWhatsAppFollowUp(quote: FinalQuote, bookingCreatedAt: Date | string): Promise<void> {
  // Don't schedule if booking is confirmed
  if (quote.status === 'confirmed') {
    console.log(`[WhatsApp] Skipping 7-day follow-up scheduling for confirmed booking ${quote.id}`);
    return;
  }

  // Don't schedule if booking is cancelled
  if (quote.status === 'cancelled') {
    console.log(`[WhatsApp] Skipping 7-day follow-up scheduling for cancelled booking ${quote.id}`);
    return;
  }

  // Don't schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 7-day follow-up scheduling for booking ${quote.id} - advance payment already made`);
    return;
  }

  // Use booking creation time
  const baseTime = typeof bookingCreatedAt === 'string' ? new Date(bookingCreatedAt) : bookingCreatedAt;
  const scheduled7D = new Date(baseTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Store the scheduled time in the booking's whatsappMessages
  const updatedQuote: FinalQuote = {
    ...quote,
    whatsappMessages: {
      ...quote.whatsappMessages,
      followup7d: {
        sent: false,
        scheduledFor: scheduled7D.toISOString(),
      },
    },
  };

  // Update booking with scheduled follow-up
  const { error } = await supabaseAdmin
    .from('bookings')
    .update({ 
      final_quote: updatedQuote as any,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quote.id);

  if (error) {
    console.error(`[WhatsApp] Failed to schedule 7-day follow-up for booking ${quote.id}:`, error);
  } else {
    console.log(`[WhatsApp] 7-day follow-up scheduled for booking ${quote.id} at ${scheduled7D.toISOString()}`);
  }
}

/**
 * Send 2-week urgency reminder WhatsApp message
 */
export async function sendReminder2WWhatsApp(quote: FinalQuote): Promise<{
  success: boolean;
  error?: string;
  messageSid?: string;
  delivered?: boolean;
  deliveryStatus?: string;
}> {
  console.log('[WhatsApp] sendReminder2WWhatsApp called for quote:', quote.id);
  
  // Only send if booking is still quoted (not confirmed or cancelled)
  if (quote.status !== 'quoted') {
    console.log(`[WhatsApp] Skipping 2-week reminder for booking ${quote.id} - status is ${quote.status}, not 'quoted'`);
    return {
      success: false,
      error: `Booking status is ${quote.status}, not 'quoted'`,
    };
  }
  
  // Only send if advance payment has NOT been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 2-week reminder for booking ${quote.id} - advance payment already made`);
    return {
      success: false,
      error: 'Advance payment already made',
    };
  }
  
  const phone = quote.contact.phone;
  
  if (!phone) {
    console.warn('[WhatsApp] No phone number provided for 2-week reminder');
    return {
      success: false,
      error: 'No phone number provided',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.looksbyanum.com');
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  const bookCallLink = `${baseUrl}/book/${quote.id}#book-call`;
  
  // Use template SID: HX88ecb9e2f6918a92f412d89a97987be3
  const templateSid = 'HX88ecb9e2f6918a92f412d89a97987be3';
  
  const message = `Hi ${quote.contact.name}! 👋

Just a quick heads-up — your event is only 2 weeks away! ⏳✨

To ensure we reserve your spot and finalize all details in time, your custom quote is ready and waiting for you.

🎉 Special December Offer:

Book any event in December — even for 2026 dates — and enjoy an exclusive 10% OFF your booking!

COUPON CODE: WINTER10

📊 View Your Quote: ${quoteLink}

This quote is fully customized for you and saved so you can revisit it anytime.

To secure your date, here are the next steps:

📞 Have questions? Book a Call with Anum: ${bookCallLink}

📅 Ready to reserve your spot? Confirm Your Appointment: ${quoteLink}

Your event is approaching fast — let's make sure everything is perfect for your special day! 💄✨

We can't wait to glam you up!

Note: This is an automated system message. For any inquiries, please contact our main business WhatsApp at +1 416-275-1719.

— LBA Team`;

  const result = await sendWhatsAppMessage(phone, message, {
    useTemplate: true,
    templateSid: templateSid,
    templateVariables: {
      '1': quote.contact.name,
      '2': quoteLink,
      '3': bookCallLink,
    },
  });
  
  return {
    success: result.success,
    error: result.error,
    messageSid: result.messageSid,
    delivered: result.delivered,
    deliveryStatus: result.deliveryStatus,
  };
}

/**
 * Send 1-week urgency reminder WhatsApp message
 */
export async function sendReminder1WWhatsApp(quote: FinalQuote): Promise<{
  success: boolean;
  error?: string;
  messageSid?: string;
  delivered?: boolean;
  deliveryStatus?: string;
}> {
  console.log('[WhatsApp] sendReminder1WWhatsApp called for quote:', quote.id);
  
  // Only send if booking is still quoted (not confirmed or cancelled)
  if (quote.status !== 'quoted') {
    console.log(`[WhatsApp] Skipping 1-week reminder for booking ${quote.id} - status is ${quote.status}, not 'quoted'`);
    return {
      success: false,
      error: `Booking status is ${quote.status}, not 'quoted'`,
    };
  }
  
  // Only send if advance payment has NOT been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 1-week reminder for booking ${quote.id} - advance payment already made`);
    return {
      success: false,
      error: 'Advance payment already made',
    };
  }
  
  const phone = quote.contact.phone;
  
  if (!phone) {
    console.warn('[WhatsApp] No phone number provided for 1-week reminder');
    return {
      success: false,
      error: 'No phone number provided',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.looksbyanum.com');
  const quoteLink = `${baseUrl}/book/${quote.id}`;
  const bookCallLink = `${baseUrl}/book/${quote.id}#book-call`;
  
  // Use template SID: HX588ab40848d634eb02a8add158d33da6
  const templateSid = 'HX588ab40848d634eb02a8add158d33da6';
  
  const message = `Hi ${quote.contact.name}! 👋

This is a friendly reminder that your event is only 1 week away! ⏳✨

To make sure we secure your spot and finalize everything in time, your custom quote is ready and waiting for you.

📊 View Your Quote: ${quoteLink}

Your personalized quote is saved and available anytime.

To move forward and secure your date before it's too late:

📞 Have questions? Book a Call with Anum: ${bookCallLink}

📅 Ready to reserve your spot? Confirm Your Appointment: ${quoteLink}

Your event is right around the corner — let's make sure everything is flawless for your big day! 💄✨

We can't wait to glam you up!

Note: This is an automated system message. For any inquiries, please contact our main business WhatsApp at +1 416-275-1719.

— LBA Team`;

  const result = await sendWhatsAppMessage(phone, message, {
    useTemplate: true,
    templateSid: templateSid,
    templateVariables: {
      '1': quote.contact.name,
      '2': quoteLink,
      '3': bookCallLink,
    },
  });
  
  return {
    success: result.success,
    error: result.error,
    messageSid: result.messageSid,
    delivered: result.delivered,
    deliveryStatus: result.deliveryStatus,
  };
}

/**
 * Schedule 2-week urgency reminder WhatsApp message based on event date
 */
export async function scheduleReminder2WWhatsApp(quote: FinalQuote): Promise<void> {
  // Don't schedule if booking is confirmed or cancelled
  if (quote.status === 'confirmed' || quote.status === 'cancelled') {
    console.log(`[WhatsApp] Skipping 2-week reminder scheduling for booking ${quote.id} - status is ${quote.status}`);
    return;
  }

  // Don't schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 2-week reminder scheduling for booking ${quote.id} - advance payment already made`);
    return;
  }

  // Get the first event date
  if (!quote.booking.days || quote.booking.days.length === 0) {
    console.log(`[WhatsApp] Skipping 2-week reminder scheduling - booking ${quote.id} has no booking days`);
    return;
  }
  
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`[WhatsApp] Skipping 2-week reminder scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  try {
    const { parseToronto, getTorontoNow } = await import('./toronto-time');
    if (typeof firstDay.date === 'string') {
      eventDate = parseToronto(firstDay.date, 'PPP');
    } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
      eventDate = new Date(firstDay.date as Date);
      if (isNaN(eventDate.getTime())) {
        console.error(`[WhatsApp] Invalid date object for booking ${quote.id}`);
        return;
      }
    } else {
      console.error(`[WhatsApp] Invalid date format for booking ${quote.id}`);
      return;
    }
    
    const now = getTorontoNow();
    
    // Calculate days until event
    const daysUntilEvent = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only schedule if event is more than 14 days away
    if (daysUntilEvent <= 14) {
      console.log(`[WhatsApp] Skipping 2-week reminder scheduling for booking ${quote.id} - event is only ${daysUntilEvent} days away (need >14 days). Event date: ${eventDate.toISOString()}, Current date: ${now.toISOString()}`);
      // Store a record that we attempted to schedule but skipped due to timing
      // This prevents repeated attempts for the same booking
      const updatedQuote: FinalQuote = {
        ...quote,
        whatsappMessages: {
          ...quote.whatsappMessages,
          reminder2w: {
            sent: true, // Mark as "sent" (cancelled) to prevent re-attempts
            error: `Skipped: event is only ${daysUntilEvent} days away (need >14 days)`,
          },
        },
      };
      
      // Update booking to record the skip reason
      await supabaseAdmin
        .from('bookings')
        .update({ 
          final_quote: updatedQuote as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quote.id);
      
      return;
    }
    
    // Calculate 2 weeks before event date (14 days)
    const reminderDate = new Date(eventDate);
    reminderDate.setDate(reminderDate.getDate() - 14);
    
    // Store the scheduled time in the booking's whatsappMessages
    const updatedQuote: FinalQuote = {
      ...quote,
      whatsappMessages: {
        ...quote.whatsappMessages,
        reminder2w: {
          sent: false,
          scheduledFor: reminderDate.toISOString(),
        },
      },
    };

    // Update booking with scheduled reminder
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        final_quote: updatedQuote as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote.id);

    if (error) {
      console.error(`[WhatsApp] Failed to schedule 2-week reminder for booking ${quote.id}:`, error);
    } else {
      console.log(`[WhatsApp] 2-week reminder scheduled for booking ${quote.id} at ${reminderDate.toISOString()}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Failed to parse event date for booking ${quote.id}:`, error);
    return;
  }
}

/**
 * Schedule 1-week urgency reminder WhatsApp message based on event date
 */
export async function scheduleReminder1WWhatsApp(quote: FinalQuote): Promise<void> {
  // Don't schedule if booking is confirmed or cancelled
  if (quote.status === 'confirmed' || quote.status === 'cancelled') {
    console.log(`[WhatsApp] Skipping 1-week reminder scheduling for booking ${quote.id} - status is ${quote.status}`);
    return;
  }

  // Don't schedule if advance payment has been made
  const hasAdvancePayment = quote.paymentDetails && 
    (quote.paymentDetails.status === 'deposit-paid' || quote.paymentDetails.status === 'payment-approved');
  
  if (hasAdvancePayment) {
    console.log(`[WhatsApp] Skipping 1-week reminder scheduling for booking ${quote.id} - advance payment already made`);
    return;
  }

  // Get the first event date
  if (!quote.booking.days || quote.booking.days.length === 0) {
    console.log(`[WhatsApp] Skipping 1-week reminder scheduling - booking ${quote.id} has no booking days`);
    return;
  }
  
  const firstDay = quote.booking.days[0];
  if (!firstDay || !firstDay.date) {
    console.log(`[WhatsApp] Skipping 1-week reminder scheduling - booking ${quote.id} has no event date`);
    return;
  }

  // Parse the event date
  let eventDate: Date;
  try {
    const { parseToronto, getTorontoNow } = await import('./toronto-time');
    if (typeof firstDay.date === 'string') {
      eventDate = parseToronto(firstDay.date, 'PPP');
    } else if (firstDay.date && typeof firstDay.date === 'object' && 'getTime' in firstDay.date) {
      eventDate = new Date(firstDay.date as Date);
      if (isNaN(eventDate.getTime())) {
        console.error(`[WhatsApp] Invalid date object for booking ${quote.id}`);
        return;
      }
    } else {
      console.error(`[WhatsApp] Invalid date format for booking ${quote.id}`);
      return;
    }
    
    // Calculate 1 week before event date (7 days)
    const reminderDate = new Date(eventDate);
    reminderDate.setDate(reminderDate.getDate() - 7);
    const now = getTorontoNow();
    
    // Always schedule, but mark as cancelled if the reminder date is in the past
    const isPast = reminderDate < now;
    
    // Store the scheduled time in the booking's whatsappMessages
    const updatedQuote: FinalQuote = {
      ...quote,
      whatsappMessages: {
        ...quote.whatsappMessages,
        reminder1w: {
          sent: isPast, // Mark as sent (cancelled) if date is in the past
          scheduledFor: reminderDate.toISOString(),
          error: isPast ? 'Skipped: reminder date has passed' : undefined,
        },
      },
    };

    // Update booking with scheduled reminder
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        final_quote: updatedQuote as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote.id);

    if (error) {
      console.error(`[WhatsApp] Failed to schedule 1-week reminder for booking ${quote.id}:`, error);
    } else {
      console.log(`[WhatsApp] 1-week reminder scheduled for booking ${quote.id} at ${reminderDate.toISOString()}`);
    }
  } catch (error) {
    console.error(`[WhatsApp] Failed to parse event date for booking ${quote.id}:`, error);
    return;
  }
}

/**
 * Check the delivery status of a WhatsApp message by its SID
 */
export async function checkMessageDeliveryStatus(messageSid: string): Promise<{
  delivered: boolean;
  deliveryStatus: string;
}> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn('[WhatsApp] Twilio credentials not configured, cannot check delivery status');
      return { delivered: false, deliveryStatus: 'unknown' };
    }

    const client = twilio(accountSid, authToken);
    const message = await client.messages(messageSid).fetch();

    const delivered = message.status === 'delivered';
    const deliveryStatus = message.status || 'unknown';

    return { delivered, deliveryStatus };
  } catch (error: any) {
    console.error('[WhatsApp] Error checking message delivery status:', error);
    return { delivered: false, deliveryStatus: 'unknown' };
  }
}

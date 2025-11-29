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
  }
): Promise<{ success: boolean; error?: string; messageSid?: string; delivered?: boolean; deliveryStatus?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // Use Messaging Service SID only if explicitly configured in the environment.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+16477990213';
  // Use provided template SID from env, or default to the one you shared
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID || 'HXcbb126555332bf7bd860d3bc5aeb32fd';

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
  
  // Message aligned with your approved WhatsApp template:
  // "Hi {{1}}! 👋
  //
  //  Your custom quote is ready! 🎉
  //  📊 View Your Quote: {{2}}
  //  ...
  //  📞 Book a Call with Anum: {{3}}
  //  📅 Schedule Your Appointment: {{2}}
  //  ...
  //  This is a system generated message for you, for any inquiries please contact to our regular whatsapp : 416-275-1719"
  const message = `Hi ${quote.contact.name}! 👋

Your custom quote is ready! 🎉

📊 View Your Quote: ${quoteLink}

This quote has been fully customized for you and is saved here, so you can access it anytime you’re ready to book your makeup appointment.

When you’re ready to take the next step, here are your options:

📞 Book a Call with Anum: ${bookCallLink}

📅 Schedule Your Appointment: ${quoteLink}

We can’t wait to help make your event truly special! ✨

LBA Team

This is a system generated message for you, for any inquiries please contact to our regular whatsapp : 416-275-1719`;

  const result = await sendWhatsAppMessage(phone, message, {
    useTemplate: true,
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

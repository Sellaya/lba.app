import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import twilio from 'twilio';

export const runtime = 'nodejs'; // Explicitly set runtime for serverless functions
export const maxDuration = 10; // Max 10 seconds for Vercel

export async function POST(request: Request) {
  try {
    // Twilio sends webhooks as application/x-www-form-urlencoded
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    const to = formData.get('To') as string;
    const accountSid = formData.get('AccountSid') as string;

    console.log('[WhatsApp Webhook] Incoming message received:', {
      from: from?.substring(0, 20) + '...',
      to: to?.substring(0, 20) + '...',
      body: body?.substring(0, 50) + '...',
      bodyLength: body?.length,
      messageSid,
      accountSid: accountSid?.substring(0, 10) + '...',
      contentType: request.headers.get('content-type'),
      allKeys: Array.from(formData.keys()), // Debug: see all form data keys
    });

    // Extract phone number from Twilio's "whatsapp:+1234567890" format
    const phoneNumber = from?.replace('whatsapp:', '') || '';

    if (!phoneNumber) {
      console.error('[WhatsApp Webhook] No phone number found. All form data:', 
        Object.fromEntries(formData.entries())
      );
      const twiml = new twilio.twiml.MessagingResponse();
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Skip auto-reply if message body is empty (status updates, etc.)
    if (!body || body.trim().length === 0) {
      console.log('[WhatsApp Webhook] Empty message body, skipping auto-reply');
      const twiml = new twilio.twiml.MessagingResponse();
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Auto-reply message
    const autoReplyMessage = `Thank you for your message. This number is used only for sending automated updates. For any inquiries, please WhatsApp us directly at +1 416-275-1719.

Team LBA`;

    // IMPORTANT: Send auto-reply synchronously (await it) so we can catch errors
    console.log('[WhatsApp Webhook] Sending auto-reply to:', phoneNumber.substring(0, 10) + '...');
    const result = await sendWhatsAppMessage(phoneNumber, autoReplyMessage);

    if (result.success) {
      console.log('[WhatsApp Webhook] ✅ Auto-reply sent successfully:', {
        to: phoneNumber.substring(0, 10) + '...',
        messageSid: result.messageSid,
        deliveryStatus: result.deliveryStatus,
      });
    } else {
      console.error('[WhatsApp Webhook] ❌ Failed to send auto-reply:', {
        error: result.error,
        to: phoneNumber.substring(0, 10) + '...',
      });
    }

    // Return TwiML response
    const twiml = new twilio.twiml.MessagingResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] ❌ Error processing webhook:', {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Return empty TwiML response to prevent Twilio retries
    const twiml = new twilio.twiml.MessagingResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}

// Also handle GET requests (Twilio sometimes sends GET for webhook validation)
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'whatsapp-webhook' });
}


import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import twilio from 'twilio';

export async function POST(request: Request) {
  try {
    // Parse the incoming Twilio webhook data
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log('[WhatsApp Webhook] Incoming message received:', {
      from: from?.substring(0, 20) + '...',
      bodyLength: body?.length,
      messageSid,
    });

    // Extract phone number from Twilio's "whatsapp:+1234567890" format
    const phoneNumber = from?.replace('whatsapp:', '') || '';

    if (!phoneNumber) {
      console.error('[WhatsApp Webhook] No phone number found in webhook');
      return NextResponse.json({ error: 'No phone number' }, { status: 400 });
    }

    // Auto-reply message
    const autoReplyMessage = `Thank you for your message. This number is used only for sending automated updates. For any inquiries, please WhatsApp us directly at +1 416-275-1719.

Team LBA`;

    // Send auto-reply
    const result = await sendWhatsAppMessage(phoneNumber, autoReplyMessage);

    if (result.success) {
      console.log('[WhatsApp Webhook] Auto-reply sent successfully:', {
        to: phoneNumber.substring(0, 10) + '...',
        messageSid: result.messageSid,
      });
    } else {
      console.error('[WhatsApp Webhook] Failed to send auto-reply:', result.error);
    }

    // Return TwiML response (Twilio expects this)
    // Even if auto-reply fails, we return success to Twilio to avoid retries
    const twiml = new twilio.twiml.MessagingResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error processing webhook:', error);
    
    // Return empty TwiML response to prevent Twilio retries
    const twiml = new twilio.twiml.MessagingResponse();
    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}

// Also handle GET requests (Twilio sometimes sends GET for webhook validation)
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}


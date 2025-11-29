import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import twilio from 'twilio';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Helper function to send auto-reply with retry logic
async function sendAutoReplyWithRetry(
  phoneNumber: string,
  message: string,
  maxRetries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[WhatsApp Webhook] Sending auto-reply (attempt ${attempt}/${maxRetries}) to:`, phoneNumber.substring(0, 10) + '...');
      
      // Set a timeout for the entire send operation (15 seconds max)
      const sendPromise = sendWhatsAppMessage(phoneNumber, message);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Send operation timeout')), 15000)
      );
      
      const result = await Promise.race([sendPromise, timeoutPromise]) as any;

      if (result.success) {
        console.log('[WhatsApp Webhook] ✅ Auto-reply sent successfully:', {
          to: phoneNumber.substring(0, 10) + '...',
          messageSid: result.messageSid,
          deliveryStatus: result.deliveryStatus,
          attempt,
        });
        return; // Success, exit retry loop
      } else {
        console.error(`[WhatsApp Webhook] ❌ Auto-reply failed (attempt ${attempt}/${maxRetries}):`, {
          error: result.error,
          to: phoneNumber.substring(0, 10) + '...',
        });
        
        // If it's the last attempt, give up
        if (attempt === maxRetries) {
          console.error('[WhatsApp Webhook] ❌ All retry attempts failed');
          return;
        }
        
        // Shorter wait before retrying (500ms, 1s, 1.5s)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    } catch (error: any) {
      const isTimeout = error?.message?.includes('timeout') || 
                       error?.code === 'ECONNABORTED' || 
                       error?.code === 'ECONNRESET' ||
                       error?.message === 'Send operation timeout';
      
      console.error(`[WhatsApp Webhook] ❌ Error sending auto-reply (attempt ${attempt}/${maxRetries}):`, {
        error: error?.message,
        code: error?.code,
        isTimeout,
      });
      
      // If it's the last attempt, give up
      if (attempt === maxRetries) {
        console.error('[WhatsApp Webhook] ❌ All retry attempts failed');
        return;
      }
      
      // Shorter wait before retrying (500ms, 1s, 1.5s)
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
}

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
      allKeys: Array.from(formData.keys()),
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

    // Send auto-reply asynchronously (don't await) so webhook responds quickly
    // This prevents connection timeouts in serverless environments
    sendAutoReplyWithRetry(phoneNumber, autoReplyMessage).catch((error) => {
      console.error('[WhatsApp Webhook] ❌ Fatal error in auto-reply retry:', error);
    });

    // Return TwiML response immediately (don't wait for auto-reply)
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


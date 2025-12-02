import { NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import twilio from 'twilio';

export const runtime = 'nodejs';
export const maxDuration = 10;

// Helper function to send auto-reply with retry logic
// Note: Twilio SDK has internal 30s timeout, so we accept that some requests may timeout
// The webhook responds immediately, and retries happen in background
async function sendAutoReplyWithRetry(
  phoneNumber: string,
  message: string,
  maxRetries = 2 // Reduced to 2 retries since Twilio API can be slow
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[WhatsApp Webhook] Sending auto-reply (attempt ${attempt}/${maxRetries}) to:`, phoneNumber.substring(0, 10) + '...');
      
      // Call Twilio directly - it has its own 30s timeout
      // We don't add an additional timeout wrapper since Promise.race doesn't cancel the request
      const result = await sendWhatsAppMessage(phoneNumber, message);

      if (result.success) {
        console.log('[WhatsApp Webhook] ✅ Auto-reply sent successfully:', {
          to: phoneNumber.substring(0, 10) + '...',
          messageSid: result.messageSid,
          deliveryStatus: result.deliveryStatus,
          attempt,
        });
        return; // Success, exit retry loop
      } else {
        const isTimeout = result.error?.includes('timeout') || 
                         result.error?.includes('ECONNABORTED') || 
                         result.error?.includes('ECONNRESET');
        
        console.error(`[WhatsApp Webhook] ❌ Auto-reply failed (attempt ${attempt}/${maxRetries}):`, {
          error: result.error,
          to: phoneNumber.substring(0, 10) + '...',
          isTimeout,
        });
        
        // If it's the last attempt, give up
        if (attempt === maxRetries) {
          console.error('[WhatsApp Webhook] ❌ All retry attempts failed - Twilio API timeout. Webhook responded successfully, but auto-reply could not be sent due to Twilio API slowness.');
          console.warn('[WhatsApp Webhook] ⚠️  This is a Twilio API issue, not a webhook issue. The webhook is working correctly.');
          return;
        }
        
        // Very short wait before retrying (200ms, 400ms) - Twilio API might be temporarily slow
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    } catch (error: any) {
      const isTimeout = error?.message?.includes('timeout') || 
                       error?.code === 'ECONNABORTED' || 
                       error?.code === 'ECONNRESET';
      
      console.error(`[WhatsApp Webhook] ❌ Error sending auto-reply (attempt ${attempt}/${maxRetries}):`, {
        error: error?.message,
        code: error?.code,
        isTimeout,
      });
      
      // If it's the last attempt, give up
      if (attempt === maxRetries) {
        console.error('[WhatsApp Webhook] ❌ All retry attempts failed - Twilio API timeout. Webhook responded successfully, but auto-reply could not be sent due to Twilio API slowness.');
        console.warn('[WhatsApp Webhook] ⚠️  This is a Twilio API issue, not a webhook issue. The webhook is working correctly.');
        return;
      }
      
      // Very short wait before retrying (200ms, 400ms)
      await new Promise(resolve => setTimeout(resolve, 200 * attempt));
    }
  }
}

export async function POST(request: Request) {
  // BEST PRACTICE: Read request data (fast, necessary), then send response, then do processing
  // This ensures Twilio gets a quick response and doesn't retry
  
  try {
    // Step 1: Read request data (fast operation, must be done before response)
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const phoneNumber = from?.replace('whatsapp:', '') || '';

    // Step 2: Prepare and send response IMMEDIATELY (before any processing)
    const twiml = new twilio.twiml.MessagingResponse();
    const response = new NextResponse(twiml.toString(), {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

    // Step 3: Do ALL processing AFTER response is prepared (runs in background)
    // This includes: logging, validation, DB writes, API calls, etc.
    setImmediate(async () => {
      try {
        const messageSid = formData.get('MessageSid') as string;
        const to = formData.get('To') as string;
        const accountSid = formData.get('AccountSid') as string;

        console.log('[WhatsApp Webhook] Processing incoming message:', {
          from: from?.substring(0, 20) + '...',
          to: to?.substring(0, 20) + '...',
          body: body?.substring(0, 50) + '...',
          bodyLength: body?.length,
          messageSid,
          accountSid: accountSid?.substring(0, 10) + '...',
          contentType: request.headers.get('content-type'),
          allKeys: Array.from(formData.keys()),
        });

        if (!phoneNumber) {
          console.error('[WhatsApp Webhook] No phone number found. All form data:', 
            Object.fromEntries(formData.entries())
          );
          return;
        }

        // Skip auto-reply if message body is empty (status updates, etc.)
        if (!body || body.trim().length === 0) {
          console.log('[WhatsApp Webhook] Empty message body, skipping auto-reply');
          return;
        }

        // Auto-reply message
        const autoReplyMessage = `Thank you for your message. This number is used only for sending automated updates. For any inquiries, please WhatsApp us directly at +1 416-275-1719.

Team LBA`;

        // Send auto-reply (all heavy processing happens after response is sent)
        sendAutoReplyWithRetry(phoneNumber, autoReplyMessage).catch((error) => {
          console.error('[WhatsApp Webhook] ❌ Fatal error in auto-reply retry:', error);
        });
      } catch (error: any) {
        console.error('[WhatsApp Webhook] ❌ Error in background processing:', {
          error: error?.message,
          stack: error?.stack,
          name: error?.name,
        });
      }
    });

    // Return response immediately - all processing happens in background
    return response;
  } catch (error: any) {
    // If we can't even read the request, still return a response
    console.error('[WhatsApp Webhook] ❌ Error reading request:', {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
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


import { NextResponse } from 'next/server';
import { sendBookCallEmails } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      customerName, 
      customerEmail, 
      customerPhone, 
      whatsappNumber, 
      preferredDate, 
      preferredTime, 
      message,
      bookingId 
    } = body;

    // Validate required fields
    if (!customerName || !customerEmail || !whatsappNumber || !preferredDate || !preferredTime || !message || !bookingId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate WhatsApp number format (should be digits only or with +)
    const whatsappClean = whatsappNumber.replace(/[^0-9+]/g, '');
    if (whatsappClean.length < 10) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp number format' },
        { status: 400 }
      );
    }

    // Send emails
    await sendBookCallEmails({
      customerName,
      customerEmail,
      customerPhone: customerPhone || '',
      whatsappNumber: whatsappClean,
      preferredDate,
      preferredTime,
      message: message || '',
      bookingId,
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Call booking request submitted successfully' 
    });

  } catch (error: any) {
    console.error('Error in POST /api/book-call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit call booking request' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { sendBookCallEmails } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { FinalQuote } from '@/lib/types';

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

    // Fetch existing booking to update it with consultation request
    const { data: existingBooking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('final_quote')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking || !existingBooking.final_quote) {
      console.error('Error fetching booking:', fetchError);
      // Continue with email sending even if booking fetch fails (backward compatibility)
    } else {
      // Update the booking with consultation request
      const finalQuote: FinalQuote = existingBooking.final_quote as FinalQuote;
      const updatedQuote: FinalQuote = {
        ...finalQuote,
        consultationRequest: {
          whatsappNumber: whatsappClean,
          preferredDate,
          preferredTime,
          message: message || '',
          submittedAt: new Date().toISOString(),
        },
      };

      // Save updated booking
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ 
          final_quote: updatedQuote,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Error updating booking with consultation request:', updateError);
        // Continue with email sending even if update fails
      }
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


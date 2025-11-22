import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, email } = body;

    if (!bookingId || !email) {
      return NextResponse.json(
        { error: 'Booking ID and email are required' },
        { status: 400 }
      );
    }

    // Fetch booking from Supabase
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId.trim())
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: 'Booking not found with these details' },
        { status: 404 }
      );
    }

    // Extract email from final_quote
    const finalQuote = booking.final_quote || booking.finalQuote;
    const bookingEmail = finalQuote?.contact?.email?.toLowerCase().trim();
    const providedEmail = email.toLowerCase().trim();

    // Verify email matches
    if (bookingEmail !== providedEmail) {
      return NextResponse.json(
        { error: 'Booking not found with these details' },
        { status: 404 }
      );
    }

    // Return success - booking ID and email match
    return NextResponse.json({ 
      success: true,
      bookingId: booking.id 
    });

  } catch (error: any) {
    console.error('Error in POST /api/bookings/verify:', error);
    return NextResponse.json(
      { error: 'Booking not found with these details' },
      { status: 500 }
    );
  }
}
















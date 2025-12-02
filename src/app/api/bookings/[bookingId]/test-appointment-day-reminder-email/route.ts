import { NextResponse } from 'next/server';
import { getBooking } from '@/firebase/server-actions';
import { sendAppointmentDayReminderEmail } from '@/lib/email';

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }
) {
	try {
		// Handle both sync and async params (Next.js 15 compatibility)
		const resolvedParams = params instanceof Promise ? await params : params;
		const bookingId = resolvedParams.bookingId;

		if (!bookingId) {
			return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
		}

		// Fetch the booking
		const booking = await getBooking(bookingId);
		
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		// Validate booking is confirmed and has payment
		if (booking.finalQuote.status !== 'confirmed') {
			return NextResponse.json({ 
				error: 'Booking must be confirmed to send appointment day reminder email' 
			}, { status: 400 });
		}

		const hasAdvancePayment = booking.finalQuote.paymentDetails && 
			(booking.finalQuote.paymentDetails.status === 'deposit-paid' || 
			 booking.finalQuote.paymentDetails.status === 'payment-approved');
		
		if (!hasAdvancePayment) {
			return NextResponse.json({ 
				error: 'Booking must have advance payment to send appointment day reminder email' 
			}, { status: 400 });
		}

		// Send the appointment day reminder email
		await sendAppointmentDayReminderEmail(booking.finalQuote);

		return NextResponse.json({ 
			success: true, 
			message: 'Appointment day reminder email sent successfully' 
		});

	} catch (e: any) {
		console.error('Error in POST /api/bookings/[bookingId]/test-appointment-day-reminder-email:', e);
		return NextResponse.json(
			{ error: e?.message || 'Failed to send appointment day reminder email' },
			{ status: 500 }
		);
	}
}


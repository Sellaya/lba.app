import { NextResponse } from 'next/server';
import { getBooking } from '@/firebase/server-actions';
import { sendFollowUp6DEmail } from '@/lib/email';

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }
) {
	try {
		const resolvedParams = params instanceof Promise ? await params : params;
		const bookingId = resolvedParams.bookingId;

		if (!bookingId) {
			return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
		}

		const booking = await getBooking(bookingId);
		
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		await sendFollowUp6DEmail(booking.finalQuote);

		return NextResponse.json({ 
			success: true, 
			message: '6D follow-up email sent successfully' 
		});

	} catch (e: any) {
		console.error('Error in POST /api/bookings/[bookingId]/test-followup-6d-email:', e);
		return NextResponse.json(
			{ error: e?.message || 'Failed to send 6D follow-up email' },
			{ status: 500 }
		);
	}
}


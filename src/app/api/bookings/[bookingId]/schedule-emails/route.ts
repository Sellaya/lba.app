import { NextResponse } from 'next/server';
import { getBooking } from '@/firebase/server-actions';
import { scheduleFollowUpEmails, scheduleEventReminder24HEmail, scheduleAppointmentDayReminderEmail, schedulePostAppointmentFollowupEmail } from '@/lib/scheduled-emails';

/**
 * API endpoint to manually schedule emails for a booking
 * This is useful for existing bookings that don't have scheduled emails yet
 */
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

		console.log(`[SCHEDULE EMAILS API] Scheduling emails for booking ${bookingId}`);

		// Fetch the booking
		const booking = await getBooking(bookingId);
		
		if (!booking) {
			console.error(`[SCHEDULE EMAILS API] Booking ${bookingId} not found`);
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		console.log(`[SCHEDULE EMAILS API] Booking found: ${bookingId}, Status: ${booking.finalQuote.status}`);

		// Schedule follow-up emails (only if status is 'quoted' and no payment)
		await scheduleFollowUpEmails(booking.finalQuote);

		// Schedule event reminder, appointment day reminder, and post-appointment followup (only if confirmed with payment)
		if (booking.finalQuote.status === 'confirmed') {
			console.log(`[SCHEDULE EMAILS API] Booking is confirmed, scheduling event reminders...`);
			await scheduleEventReminder24HEmail(booking.finalQuote);
			await scheduleAppointmentDayReminderEmail(booking.finalQuote);
			await schedulePostAppointmentFollowupEmail(booking.finalQuote);
		}

		return NextResponse.json({ 
			success: true, 
			message: 'Emails scheduled successfully',
			bookingId,
			status: booking.finalQuote.status
		});
	} catch (e: any) {
		console.error(`[SCHEDULE EMAILS API] Error scheduling emails:`, e);
		return NextResponse.json(
			{ error: e.message || 'Failed to schedule emails' },
			{ status: 500 }
		);
	}
}


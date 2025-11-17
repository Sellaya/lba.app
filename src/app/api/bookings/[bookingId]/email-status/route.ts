import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
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

		// Fetch booking to get created_at timestamp (when initial email was sent)
		const { data: bookingData, error: bookingError } = await supabaseAdmin
			.from('bookings')
			.select('created_at')
			.eq('id', bookingId)
			.single();

		if (bookingError) {
			console.error('Error fetching booking:', bookingError);
			// Return default status instead of error
			return NextResponse.json({
				emailStatus: {
					'initial': { sent: false, sentAt: null, scheduledFor: null },
					'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
					'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
					'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
					'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
				}
			});
		}

		// Fetch scheduled emails for this booking
		// Handle case where scheduled_emails table might not exist
		let scheduledEmailsData: any[] = [];
		try {
			const { data, error } = await supabaseAdmin
				.from('scheduled_emails')
				.select('*')
				.eq('booking_id', bookingId)
				.order('scheduled_for', { ascending: true });

			if (error) {
				// If table doesn't exist, that's okay - we'll just have empty scheduled emails
				if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
					console.warn('scheduled_emails table does not exist yet:', error.message);
					scheduledEmailsData = [];
				} else {
					console.error('Error fetching scheduled emails:', error);
					// Don't fail completely - just use empty array
					scheduledEmailsData = [];
				}
			} else {
				scheduledEmailsData = data || [];
			}
		} catch (e: any) {
			// Catch any other errors and continue with empty array
			console.warn('Exception fetching scheduled emails:', e.message);
			scheduledEmailsData = [];
		}

		// Map email types to display names
		const emailStatus = {
			'initial': { sent: false, sentAt: null, scheduledFor: null },
			'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
			'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
			'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
			'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
		};

		// Check if initial email was sent (we can infer this from booking creation)
		// The initial email is sent when the booking is created
		if (bookingData?.created_at) {
			emailStatus.initial.sent = true;
			emailStatus.initial.sentAt = bookingData.created_at;
		}

		// Process scheduled emails
		if (scheduledEmailsData && scheduledEmailsData.length > 0) {
			scheduledEmailsData.forEach((email) => {
				if (email.email_type in emailStatus) {
					emailStatus[email.email_type as keyof typeof emailStatus] = {
						sent: email.sent,
						sentAt: email.sent_at,
						scheduledFor: email.scheduled_for,
					};
				}
			});
		}

		return NextResponse.json({ emailStatus });
	} catch (e: any) {
		console.error('Error in GET /api/bookings/[bookingId]/email-status:', e);
		// Always return emailStatus object, even on error, to prevent UI errors
		return NextResponse.json({
			emailStatus: {
				'initial': { sent: false, sentAt: null, scheduledFor: null },
				'followup-3h': { sent: false, sentAt: null, scheduledFor: null },
				'followup-6h': { sent: false, sentAt: null, scheduledFor: null },
				'followup-24h': { sent: false, sentAt: null, scheduledFor: null },
				'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
			}
		});
	}
}


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
					'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
					'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
					'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
					'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
					'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
					'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
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
			'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
			'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
			'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
			'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
			'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
			'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
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

		// Auto-schedule emails if none exist and booking is eligible
		// This ensures existing bookings get their emails scheduled when viewed
		if (scheduledEmailsData.length === 0) {
			try {
				// Fetch the full booking to check status
				const { data: fullBooking } = await supabaseAdmin
					.from('bookings')
					.select('final_quote, created_at')
					.eq('id', bookingId)
					.single();

				if (fullBooking?.final_quote) {
					const { scheduleFollowUpEmails, scheduleEventReminder24HEmail, scheduleAppointmentDayReminderEmail } = await import('@/lib/scheduled-emails');
					
					// Schedule follow-up emails if booking is quoted and no payment
					await scheduleFollowUpEmails(
						fullBooking.final_quote,
						fullBooking.created_at ? new Date(fullBooking.created_at) : undefined
					);

					// Schedule event reminders if booking is confirmed with payment
					if (fullBooking.final_quote.status === 'confirmed') {
						const { schedulePostAppointmentFollowupEmail } = await import('@/lib/scheduled-emails');
						await scheduleEventReminder24HEmail(fullBooking.final_quote);
						await scheduleAppointmentDayReminderEmail(fullBooking.final_quote);
						await schedulePostAppointmentFollowupEmail(fullBooking.final_quote);
					}

					// Re-fetch scheduled emails after scheduling
					const { data: newScheduledEmails } = await supabaseAdmin
						.from('scheduled_emails')
						.select('*')
						.eq('booking_id', bookingId)
						.order('scheduled_for', { ascending: true });

					if (newScheduledEmails && newScheduledEmails.length > 0) {
						newScheduledEmails.forEach((email) => {
							if (email.email_type in emailStatus) {
								emailStatus[email.email_type as keyof typeof emailStatus] = {
									sent: email.sent,
									sentAt: email.sent_at,
									scheduledFor: email.scheduled_for,
								};
							}
						});
					}
				}
			} catch (autoScheduleError: any) {
				// Don't fail the request if auto-scheduling fails, just log it
				console.warn(`[AUTO-SCHEDULE] Failed to auto-schedule emails for booking ${bookingId}:`, autoScheduleError.message);
			}
		}

					// Auto-schedule WhatsApp reminders if they don't exist or weren't scheduled
					// This runs independently from email scheduling - for ALL bookings when viewed
					// This ensures existing bookings get their WhatsApp reminders scheduled when viewed
					try {
						// Fetch the full booking to check WhatsApp reminder status
						const { data: fullBookingForWhatsApp } = await supabaseAdmin
							.from('bookings')
							.select('final_quote')
							.eq('id', bookingId)
							.single();

						if (fullBookingForWhatsApp?.final_quote) {
							const { ensureWhatsAppRemindersScheduled } = await import('@/lib/whatsapp-helpers');
							const quote = fullBookingForWhatsApp.final_quote;
							
							const result = await ensureWhatsAppRemindersScheduled(quote);
							if (result.scheduled2w) {
								console.log(`[AUTO-SCHEDULE] Auto-scheduled 2-week WhatsApp reminder for booking ${bookingId}`);
							}
							if (result.scheduled1w) {
								console.log(`[AUTO-SCHEDULE] Auto-scheduled 1-week WhatsApp reminder for booking ${bookingId}`);
							}
							if (result.errors.length > 0) {
								console.warn(`[AUTO-SCHEDULE] Some errors scheduling WhatsApp reminders for booking ${bookingId}:`, result.errors);
							}
						}
					} catch (whatsappScheduleError: any) {
						// Don't fail the request if WhatsApp scheduling fails, just log it
						console.warn(`[AUTO-SCHEDULE] Failed to auto-schedule WhatsApp reminders for booking ${bookingId}:`, whatsappScheduleError.message);
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
				'followup-3d': { sent: false, sentAt: null, scheduledFor: null },
				'followup-6d': { sent: false, sentAt: null, scheduledFor: null },
				'followup-30d': { sent: false, sentAt: null, scheduledFor: null },
				'event-reminder-24h': { sent: false, sentAt: null, scheduledFor: null },
				'appointment-day-reminder': { sent: false, sentAt: null, scheduledFor: null },
				'post-appointment-followup': { sent: false, sentAt: null, scheduledFor: null },
			}
		});
	}
}


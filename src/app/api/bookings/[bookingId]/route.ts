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

		const { data, error } = await supabaseAdmin
			.from('bookings')
			.select('*')
			.eq('id', bookingId)
			.single();

		if (error || !data) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		// Validate final_quote exists
		if (!data.final_quote) {
			return NextResponse.json({ error: 'Booking data is incomplete: missing final_quote' }, { status: 500 });
		}

		// Transform snake_case to camelCase for frontend
		const booking = {
			id: data.id,
			uid: data.uid,
			finalQuote: data.final_quote,
			final_quote: data.final_quote, // Keep both for compatibility
			createdAt: data.created_at ? new Date(data.created_at) : undefined,
			updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
		};

		return NextResponse.json({ booking });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }
) {
	try {
		// Handle both sync and async params (Next.js 15 compatibility)
		const resolvedParams = params instanceof Promise ? await params : params;
		const bookingId = resolvedParams.bookingId;
		
		// Add error handling for JSON parsing
		let body;
		try {
			body = await request.json();
		} catch (jsonError) {
			return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
		}

		if (!bookingId) {
			return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
		}

		const { finalQuote, final_quote } = body;

		// Use finalQuote or final_quote, preferring camelCase
		const quoteData = finalQuote || final_quote;

		if (!quoteData) {
			return NextResponse.json({ error: 'Missing quote data' }, { status: 400 });
		}

		// First, fetch the existing booking to preserve uid and created_at
		const { data: existingData, error: fetchError } = await supabaseAdmin
			.from('bookings')
			.select('uid, created_at')
			.eq('id', bookingId)
			.single();

		// If fetchError exists and it's not "not found", log it but continue
		// If booking doesn't exist, existingData will be null which is fine
		if (fetchError && fetchError.code !== 'PGRST116') {
			console.warn('Error fetching existing booking:', fetchError);
		}

		const payload: any = {
			id: bookingId,
			final_quote: quoteData,
			updated_at: new Date().toISOString(),
			// Preserve existing uid if booking exists, otherwise use default
			uid: existingData?.uid || body.uid || 'web',
			// Preserve existing created_at if booking exists, otherwise create new timestamp
			created_at: existingData?.created_at || new Date().toISOString(),
		};

		const { data, error } = await supabaseAdmin
			.from('bookings')
			.upsert(payload, { onConflict: 'id' })
			.select()
			.single();

		if (error) {
			console.error('Error upserting booking:', error);
			return NextResponse.json({ error: error.message || 'Failed to update booking' }, { status: 500 });
		}

		if (!data) {
			return NextResponse.json({ error: 'Failed to retrieve updated booking' }, { status: 500 });
		}

		// Validate final_quote exists
		if (!data.final_quote) {
			return NextResponse.json({ error: 'Booking data is incomplete: missing final_quote' }, { status: 500 });
		}

		// Schedule WhatsApp reminders if needed (non-blocking - don't fail the update if scheduling fails)
		// Skip for manual bookings - they should not receive automated notifications
		if (data.final_quote && !data.final_quote.isManualBooking) {
			try {
				const { ensureWhatsAppRemindersScheduled } = await import('@/lib/whatsapp-helpers');
				await ensureWhatsAppRemindersScheduled(data.final_quote);
			} catch (error) {
				console.error('Error scheduling WhatsApp reminders after booking update:', error);
				// Don't fail the request if reminder scheduling fails
			}
		} else if (data.final_quote?.isManualBooking) {
			console.log('Skipping WhatsApp reminders for manual booking:', bookingId);
		}

		// Transform back to camelCase for response
		const booking = {
			id: data.id,
			uid: data.uid,
			finalQuote: data.final_quote,
			final_quote: data.final_quote,
			createdAt: data.created_at ? new Date(data.created_at) : undefined,
			updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
		};

		return NextResponse.json({ booking });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}

export async function DELETE(
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

		const { error } = await supabaseAdmin
			.from('bookings')
			.delete()
			.eq('id', bookingId);

		if (error) {
			console.error('Error deleting booking:', error);
			return NextResponse.json({ error: error.message || 'Failed to delete booking' }, { status: 500 });
		}

		return NextResponse.json({ success: true, message: 'Booking deleted successfully' });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}


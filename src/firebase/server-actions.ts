'use server';

import { supabaseAdmin } from '@/lib/supabase/server';
import type { BookingDocument } from '@/firebase/firestore/bookings';

/**
 * A server-only function to fetch a booking document from Supabase.
 */
export async function getBooking(bookingId: string): Promise<BookingDocument | null> {
	if (!bookingId) {
		console.error("getBooking called with no bookingId");
		return null;
	}

	try {
		const { data, error } = await supabaseAdmin
			.from('bookings')
			.select('*')
			.eq('id', bookingId)
			.single();

		if (error) {
			console.error(`Error fetching booking ${bookingId} from server:`, error);
			throw new Error('Failed to retrieve booking data from the server.');
		}

		if (!data) {
			console.log(`Booking with ID ${bookingId} not found in Supabase.`);
			return null;
		}

		// Map snake_case (DB) -> camelCase (app)
		const finalData: any = {
			id: data.id,
			uid: data.uid,
			finalQuote: data.final_quote, // jsonb
			createdAt: data.created_at ? new Date(data.created_at) : undefined,
			updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
		};

		return finalData as BookingDocument;
	} catch (error) {
		console.error(`Error fetching booking ${bookingId} from server:`, error);
		throw new Error('Failed to retrieve booking data from the server.');
	}
}

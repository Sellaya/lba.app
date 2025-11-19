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

/**
 * Batch fetch multiple bookings at once (optimized for scheduled email processing)
 */
export async function getBookingsBatch(bookingIds: string[]): Promise<Map<string, BookingDocument | null>> {
	const resultMap = new Map<string, BookingDocument | null>();
	
	if (!bookingIds || bookingIds.length === 0) {
		return resultMap;
	}

	try {
		// Fetch all bookings in one query
		const { data, error } = await supabaseAdmin
			.from('bookings')
			.select('*')
			.in('id', bookingIds);

		if (error) {
			console.error('Error fetching bookings batch from server:', error);
			// Return map with nulls for all IDs on error
			bookingIds.forEach(id => resultMap.set(id, null));
			return resultMap;
		}

		// Map results by ID
		if (data) {
			data.forEach((item: any) => {
				const finalData: any = {
					id: item.id,
					uid: item.uid,
					finalQuote: item.final_quote,
					createdAt: item.created_at ? new Date(item.created_at) : undefined,
					updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
				};
				resultMap.set(item.id, finalData as BookingDocument);
			});
		}

		// Set null for any IDs that weren't found
		bookingIds.forEach(id => {
			if (!resultMap.has(id)) {
				resultMap.set(id, null);
			}
		});

		return resultMap;
	} catch (error) {
		console.error('Error in getBookingsBatch:', error);
		// Return map with nulls for all IDs on error
		bookingIds.forEach(id => resultMap.set(id, null));
		return resultMap;
	}
}

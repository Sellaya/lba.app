import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
	try {
		const { data, error } = await supabaseAdmin
			.from('bookings')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching bookings:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		// Transform snake_case to camelCase for frontend
		const bookings = (data || []).map((booking) => ({
			id: booking.id,
			uid: booking.uid,
			finalQuote: booking.final_quote,
			createdAt: booking.created_at ? new Date(booking.created_at) : undefined,
			updatedAt: booking.updated_at ? new Date(booking.updated_at) : undefined,
		}));

		return NextResponse.json({ bookings });
	} catch (e: any) {
		console.error('Error in GET /api/bookings:', e);
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}

















import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getBooking } from '@/firebase/server-actions';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ bookingId: string }> | { bookingId: string } }
) {
	// Apply rate limiting
	const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.FILE_UPLOAD);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		// Handle both sync and async params (Next.js 15 compatibility)
		const resolvedParams = params instanceof Promise ? await params : params;
		const bookingId = resolvedParams.bookingId;

		if (!bookingId) {
			return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
		}

		// Check if booking exists and is not cancelled BEFORE uploading
		const booking = await getBooking(bookingId);
		if (!booking) {
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		// Don't allow uploads for cancelled bookings
		if (booking.finalQuote.status === 'cancelled') {
			return NextResponse.json({ 
				error: 'Cannot upload photos for cancelled bookings' 
			}, { status: 400 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
		}

		// Validate file size (10MB max for photos)
		if (file.size > 10 * 1024 * 1024) {
			return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		// Upload to Supabase Storage
		const filePath = `makeup_photos/${bookingId}/${Date.now()}_${file.name}`;
		const fileBuffer = await file.arrayBuffer();
		const bucketName = 'payment-screenshots'; // Using same bucket

		// Check if bucket exists, create if it doesn't
		const { data: buckets } = await supabaseAdmin.storage.listBuckets();
		const bucketExists = buckets?.some(b => b.name === bucketName);

		if (!bucketExists) {
			// Create the bucket if it doesn't exist
			const { data: bucketData, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
				public: true,
				allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
				fileSizeLimit: 10485760, // 10MB in bytes
			});

			if (createError) {
				console.error('Failed to create storage bucket:', createError);
				// Continue anyway - upload will fail with clearer error if bucket truly doesn't exist
			} else {
				console.log('Created storage bucket:', bucketName);
			}
		}

		// Upload to Supabase Storage
		const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
			.from(bucketName)
			.upload(filePath, fileBuffer, {
				contentType: file.type,
				upsert: false, // Don't overwrite, allow multiple photos
			});

		if (uploadError) {
			console.error('Supabase Storage upload error:', uploadError);
			return NextResponse.json({ error: uploadError.message }, { status: 500 });
		}

		// Get public URL
		const { data: urlData } = supabaseAdmin.storage
			.from(bucketName)
			.getPublicUrl(filePath);

		// Re-fetch booking to get latest state (prevents race conditions)
		const latestBooking = await getBooking(bookingId);
		if (!latestBooking) {
			// Clean up uploaded file if booking no longer exists
			await supabaseAdmin.storage.from(bucketName).remove([filePath]).catch(() => {});
			return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
		}

		// Double-check booking is still not cancelled (status might have changed)
		if (latestBooking.finalQuote.status === 'cancelled') {
			// Clean up uploaded file for cancelled booking
			await supabaseAdmin.storage.from(bucketName).remove([filePath]).catch(() => {});
			return NextResponse.json({ 
				error: 'Cannot upload photos for cancelled bookings' 
			}, { status: 400 });
		}

		// Add the new image URL to the makeupImages array
		const existingImages = latestBooking.finalQuote.booking.makeupImages || [];
		
		// Check if URL already exists (prevent duplicates)
		if (existingImages.includes(urlData.publicUrl)) {
			return NextResponse.json({ 
				url: urlData.publicUrl,
				message: 'Photo already uploaded' 
			});
		}

		const updatedImages = [...existingImages, urlData.publicUrl];

		const updatedQuote = {
			...latestBooking.finalQuote,
			booking: {
				...latestBooking.finalQuote.booking,
				makeupImages: updatedImages,
			},
		};

		// Fetch existing booking to preserve uid and created_at
		const { data: existingData, error: fetchError } = await supabaseAdmin
			.from('bookings')
			.select('uid, created_at')
			.eq('id', bookingId)
			.single();

		// Handle error (PGRST116 = not found, which is okay - we'll use fallback values)
		if (fetchError && fetchError.code !== 'PGRST116') {
			console.warn('Error fetching existing booking data for upload:', fetchError);
			// Continue with fallback values
		}

		// Update in Supabase
		const { error: updateError } = await supabaseAdmin
			.from('bookings')
			.update({ 
				final_quote: updatedQuote as any,
				updated_at: new Date().toISOString(),
				// Preserve existing uid and created_at
				uid: existingData?.uid || latestBooking.uid || 'web',
				created_at: existingData?.created_at || (latestBooking.createdAt instanceof Date ? latestBooking.createdAt.toISOString() : new Date().toISOString()),
			})
			.eq('id', bookingId);

		if (updateError) {
			console.error('Error updating booking with makeup image:', updateError);
			// Attempt to clean up uploaded file on update failure
			await supabaseAdmin.storage.from(bucketName).remove([filePath]).catch(() => {});
			return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
		}

		return NextResponse.json({ 
			url: urlData.publicUrl,
			message: 'Photo uploaded successfully' 
		});
	} catch (e: any) {
		console.error('Upload makeup photo error:', e);
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}


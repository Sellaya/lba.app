import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const userId = formData.get('userId') as string || 'web';

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
		}

		// Validate file size (5MB max)
		if (file.size > 5 * 1024 * 1024) {
			return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
		}

		const filePath = `inspirations/${userId}/${bookingId}/${Date.now()}_${file.name}`;
		const fileBuffer = await file.arrayBuffer();
		const bucketName = 'payment-screenshots'; // Using same bucket as screenshots

		// Check if bucket exists, create if it doesn't
		const { data: buckets } = await supabaseAdmin.storage.listBuckets();
		const bucketExists = buckets?.some(b => b.name === bucketName);

		if (!bucketExists) {
			// Create the bucket if it doesn't exist
			const { data: bucketData, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
				public: true,
				allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg'],
				fileSizeLimit: 5242880, // 5MB in bytes
			});

			if (createError) {
				console.error('Failed to create storage bucket:', createError);
			} else {
				console.log('Created storage bucket:', bucketName);
			}
		}

		// Upload to Supabase Storage
		const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
			.from(bucketName)
			.upload(filePath, fileBuffer, {
				contentType: file.type,
				upsert: true,
			});

		if (uploadError) {
			console.error('Supabase Storage upload error:', uploadError);
			if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
				return NextResponse.json({ 
					error: 'Storage bucket not found. Please create a bucket named "payment-screenshots" in your Supabase Storage settings.' 
				}, { status: 500 });
			}
			return NextResponse.json({ error: uploadError.message }, { status: 500 });
		}

		// Get public URL
		const { data: urlData } = supabaseAdmin.storage
			.from(bucketName)
			.getPublicUrl(filePath);

		return NextResponse.json({ url: urlData.publicUrl });
	} catch (e: any) {
		console.error('Upload inspiration image error:', e);
		return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
	}
}













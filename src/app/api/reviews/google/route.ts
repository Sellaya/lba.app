import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    // Updated to correct business Place ID (Looks By Anum business listing)
    const placeId = process.env.GOOGLE_PLACE_ID || 
      'ChIJAQAQxKMiK4gRINa1KDtajlg';

    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'Google Places API key not configured. Please set GOOGLE_PLACES_API_KEY in your environment variables.',
          reviews: []
        },
        { status: 200 } // Return 200 with empty reviews so UI doesn't break
      );
    }

    // Fetch place details including reviews
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,reviews,user_ratings_total,formatted_address&key=${apiKey}`,
      { 
        next: { revalidate: 3600 }, // Cache for 1 hour
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Places API error:', errorText);
      return NextResponse.json(
        { 
          error: `Failed to fetch reviews: ${response.status}`,
          reviews: []
        },
        { status: 200 } // Return 200 with empty reviews so UI doesn't break
      );
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API status:', data.status, data.error_message);
      return NextResponse.json(
        { 
          error: data.error_message || `API returned status: ${data.status}`,
          status: data.status,
          reviews: []
        },
        { status: 200 } // Return 200 with empty reviews so UI doesn't break
      );
    }

    if (!data.result) {
      return NextResponse.json(
        { reviews: [], message: 'No place data found for this location' },
        { status: 200 }
      );
    }

    if (!data.result.reviews || data.result.reviews.length === 0) {
      return NextResponse.json(
        { 
          reviews: [], 
          message: 'No reviews found for this location',
          placeName: data.result.name
        },
        { status: 200 }
      );
    }

    // Transform reviews to your format - get ALL reviews
    const allReviews = data.result.reviews || [];
    const reviews = allReviews
      .filter((review: any) => review.rating && review.text) // Only include reviews with rating and text
      .map((review: any) => {
        // Convert timestamp to readable date
        const reviewDate = review.time 
          ? new Date(review.time * 1000) 
          : new Date();
        
        return {
          id: review.time?.toString() || `review-${Math.random().toString(36).substr(2, 9)}`,
          author: review.author_name || 'Anonymous',
          rating: review.rating || 5,
          text: review.text || '',
          date: reviewDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          relativeTime: review.relative_time_description || '',
          photo: review.profile_photo_url || null,
          // Additional metadata
          language: review.language || 'en',
        };
      })
      .sort((a: any, b: any) => {
        // Sort by rating (highest first), then by date (newest first)
        if (b.rating !== a.rating) return b.rating - a.rating;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
    // Return all reviews, no limit

    return NextResponse.json({ 
      reviews,
      placeName: data.result.name,
      averageRating: data.result.rating,
      totalRatings: data.result.user_ratings_total,
      address: data.result.formatted_address
    });
  } catch (error: any) {
    console.error('Error fetching Google reviews:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch reviews',
        reviews: [],
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 200 } // Return 200 with empty reviews so UI doesn't break
    );
  }
}


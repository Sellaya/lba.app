'use client';

import { useEffect, useState } from 'react';
import { Star, MessageSquare, MapPin, Loader2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  relativeTime?: string;
  photo?: string | null;
}

interface GoogleReviewsData {
  reviews: Review[];
  placeName?: string;
  averageRating?: number;
  totalRatings?: number;
  address?: string;
  error?: string;
  message?: string;
}

export function GoogleReviews() {
  const [data, setData] = useState<GoogleReviewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReviews() {
      try {
        const response = await fetch('/api/reviews/google', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching reviews:', error);
        // Set empty reviews with error message, but don't break the UI
        setData({ 
          reviews: [], 
          error: error instanceof Error ? error.message : 'Failed to load reviews',
          message: 'Reviews will appear here once available.'
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchReviews();
  }, []);

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading reviews...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const reviews = data?.reviews || [];
  const hasReviews = reviews.length > 0;
  const hasError = !!data?.error;
  const hasMessage = !!data?.message;

  // Remove any duplicate reviews by ID to ensure uniqueness
  const uniqueReviews = reviews.filter((review, index, self) => 
    index === self.findIndex((r) => r.id === review.id)
  );

  // Each banner should show 10 unique reviews
  // If we have fewer than 20 reviews, we'll distribute them evenly
  const reviewsPerBanner = 10;
  const totalNeeded = reviewsPerBanner * 2; // 20 reviews total for both banners

  // If we have fewer reviews than needed, use what we have and split evenly
  let firstBannerReviews: typeof uniqueReviews;
  let secondBannerReviews: typeof uniqueReviews;

  if (uniqueReviews.length >= totalNeeded) {
    // We have enough reviews - take first 10 for banner 1, next 10 for banner 2
    firstBannerReviews = uniqueReviews.slice(0, reviewsPerBanner);
    secondBannerReviews = uniqueReviews.slice(reviewsPerBanner, reviewsPerBanner * 2);
  } else if (uniqueReviews.length >= reviewsPerBanner) {
    // We have at least 10 reviews - split them
    const midPoint = Math.ceil(uniqueReviews.length / 2);
    firstBannerReviews = uniqueReviews.slice(0, midPoint);
    secondBannerReviews = uniqueReviews.slice(midPoint);
  } else {
    // We have fewer than 10 reviews - split what we have
    const midPoint = Math.ceil(uniqueReviews.length / 2);
    firstBannerReviews = uniqueReviews.slice(0, midPoint);
    secondBannerReviews = uniqueReviews.slice(midPoint);
  }

  // For seamless infinite scroll, duplicate each banner's unique set
  // This creates continuous scrolling - duplicates only appear after all unique reviews
  const firstBannerDuplicated = [...firstBannerReviews, ...firstBannerReviews];
  const secondBannerDuplicated = [...secondBannerReviews, ...secondBannerReviews];

  return (
    <section 
      className={cn(
        "py-8 md:py-12 px-0 bg-gradient-to-b from-background via-muted/10 to-background relative overflow-hidden"
      )}
    >
      <div className="container mx-auto max-w-7xl relative z-10 px-4">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <MessageSquare className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
              What Our Clients Say
            </h2>
          </div>
          
          {data?.averageRating && data?.totalRatings && (
            <div className="flex items-center justify-center gap-3 mt-3 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4 md:h-5 md:w-5 transition-colors",
                        i < Math.round(data.averageRating!)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-muted text-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="text-xl md:text-2xl font-bold text-foreground">
                  {data.averageRating.toFixed(1)}
                </span>
              </div>
              <span className="text-muted-foreground text-sm md:text-base">
                ({data.totalRatings.toLocaleString()} reviews)
              </span>
            </div>
          )}

          {data?.placeName && (
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs md:text-sm text-muted-foreground">
              <MapPin className="h-3 w-3 md:h-4 md:w-4" />
              <span>{data.placeName}</span>
            </div>
          )}

          <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-2xl mx-auto px-2">
            Real reviews from satisfied customers who trusted us with their special moments.
          </p>
        </div>

        {/* Error/Message State */}
        {(hasError || hasMessage) && !hasReviews && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {hasError 
                ? (data.error === 'Google Places API key not configured. Please set GOOGLE_PLACES_API_KEY in your environment variables.'
                    ? 'Reviews will appear here once configured.'
                    : data.error)
                : data.message || 'No reviews available at this time.'}
            </p>
          </div>
        )}

        {/* Floating Review Banners - Two Way Scrolling */}
        {hasReviews && (
          <div className="space-y-4 md:space-y-6">
            {/* First Banner - Scrolls Left - Unique Reviews Only */}
            <div className="relative overflow-hidden mask-gradient">
              <div className="flex animate-scroll-left gap-3 md:gap-4">
                {/* Show all unique reviews from first half, then duplicate for seamless scroll */}
                {firstBannerDuplicated.map((review, index) => (
                  <ReviewCard 
                    key={`first-${review.id}-${index}`} 
                    review={review}
                    isCompact={true}
                  />
                ))}
              </div>
            </div>

            {/* Second Banner - Scrolls Right - Unique Reviews Only */}
            <div className="relative overflow-hidden mask-gradient">
              <div className="flex animate-scroll-right gap-3 md:gap-4">
                {/* Show all unique reviews from second half, then duplicate for seamless scroll */}
                {secondBannerDuplicated.map((review, index) => (
                  <ReviewCard 
                    key={`second-${review.id}-${index}`} 
                    review={review}
                    isCompact={true}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Google Reviews Link */}
        {hasReviews && data?.address && (
          <div className="text-center mt-6 md:mt-8">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              <span>View all reviews on Google</span>
              <ExternalLink className="h-3 w-3 md:h-4 md:w-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewCard({ 
  review,
  isCompact = false
}: { 
  review: Review;
  isCompact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-shrink-0 bg-background rounded-lg border shadow-sm",
        "transition-all duration-300 ease-out",
        "hover:shadow-md hover:border-primary/20",
        isCompact 
          ? "w-[280px] sm:w-[320px] md:w-[360px] p-3 md:p-4" 
          : "p-6"
      )}
    >
      <div className="relative">
        {/* Header with Name and Rating - No Profile Images */}
        <div className="mb-2 md:mb-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-xs md:text-sm truncate pr-2">
              {review.author}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "h-3 w-3 md:h-3.5 md:w-3.5 transition-colors",
                    i < review.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "fill-muted text-muted"
                  )}
                />
              ))}
            </div>
          </div>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            {review.relativeTime || review.date}
          </p>
        </div>

        {/* Review Text - Compact for mobile */}
        <p className="text-xs md:text-sm text-foreground leading-relaxed line-clamp-3 md:line-clamp-4">
          {review.text}
        </p>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { QuoteConfirmation } from '@/components/quote-confirmation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { trackPageView, trackEvent } from '@/lib/facebook-pixel';

export default function BookPage() {
  const params = useParams();
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [booking, setBooking] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!bookingId) return;

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/bookings/${bookingId}`, { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Booking not found' }));
          setError(data.error || 'Booking not found');
          setBooking(null);
        } else {
          const { booking } = await res.json();
          if (mounted) setBooking(booking);
        }
      } catch (e: any) {
        setError('Failed to load booking');
        setBooking(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [bookingId]);

  // Track page view when booking page loads
  useEffect(() => {
    if (!isLoading && bookingId) {
      // Track page view
      trackPageView();
      
      // Track quote view event
      trackEvent('ViewQuote', {
        content_name: 'Quote View',
        content_category: 'Quote',
        booking_id: bookingId,
      });
    }
  }, [isLoading, bookingId]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-black" />
          <p className="mt-4 text-muted-foreground">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mt-4" />
          <h1 className="text-2xl font-bold text-destructive mt-4">Error Loading Booking</h1>
          <p className="mt-2 text-muted-foreground">Could not load the requested booking. It may have been removed or you may not have permission to view it.</p>
          <p className="mt-1 text-xs text-muted-foreground">ID: {bookingId}</p>
        </div>
      </div>
    );
  }

  if (booking) {
    const finalQuote = booking.final_quote || booking.finalQuote;
    if (!finalQuote) {
      return (
        <div className="flex flex-col min-h-screen">
          <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
            <AlertTriangle className="w-12 h-12 text-destructive mt-4" />
            <h1 className="text-2xl font-bold text-destructive mt-4">Invalid Booking Data</h1>
            <p className="mt-2 text-muted-foreground">The booking data is incomplete or invalid.</p>
          </div>
        </div>
      );
    }
    return <QuoteConfirmation quote={finalQuote} />;
  }

  return null;
}

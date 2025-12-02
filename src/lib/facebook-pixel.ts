// Facebook Pixel tracking utility
declare global {
  interface Window {
    fbq?: {
      (...args: any[]): void;
      q?: any[][];
      callMethod?: (...args: any[]) => void;
      queue?: any[];
      loaded?: boolean;
      version?: string;
      push?: any;
    };
    _fbq?: any;
  }
}

// Track custom events
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  try {
    if (typeof window === 'undefined') return;
    
    // Wait for fbq to be available
    if (window.fbq && typeof window.fbq === 'function') {
      window.fbq('track', eventName, eventData);
    } else {
      // Queue the event if fbq is not loaded yet (non-blocking)
      setTimeout(() => {
        try {
          if (window.fbq && typeof window.fbq === 'function') {
            window.fbq('track', eventName, eventData);
          }
        } catch (error) {
          // Silently fail - tracking should never block functionality
          console.warn('Facebook Pixel tracking failed:', error);
        }
      }, 100);
    }
  } catch (error) {
    // Silently fail - tracking should never block functionality
    console.warn('Facebook Pixel tracking error:', error);
  }
}

// Track quote generation
export function trackQuoteGenerated(quoteData: {
  bookingId: string;
  totalAmount: number;
  currency?: string;
  serviceType?: string;
}) {
  trackEvent('QuoteGenerated', {
    content_name: 'Makeup Service Quote',
    content_category: 'Quote',
    value: quoteData.totalAmount,
    currency: quoteData.currency || 'CAD',
    booking_id: quoteData.bookingId,
    service_type: quoteData.serviceType,
  });
}

// Track payment completion
export function trackPaymentComplete(paymentData: {
  bookingId: string;
  amount: number;
  currency?: string;
  paymentType: 'advance' | 'final';
  paymentMethod: 'stripe' | 'interac';
}) {
  trackEvent('Purchase', {
    content_name: paymentData.paymentType === 'advance' ? 'Advance Payment' : 'Final Payment',
    content_category: 'Payment',
    value: paymentData.amount,
    currency: paymentData.currency || 'CAD',
    booking_id: paymentData.bookingId,
    payment_type: paymentData.paymentType,
    payment_method: paymentData.paymentMethod,
  });
}

// Track page view
export function trackPageView() {
  try {
    if (typeof window === 'undefined') return;
    if (window.fbq && typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
  } catch (error) {
    // Silently fail - tracking should never block functionality
    console.warn('Facebook Pixel page view tracking failed:', error);
  }
}


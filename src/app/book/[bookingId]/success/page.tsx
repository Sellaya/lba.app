
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { sendConfirmationEmailAction, sendFinalPaymentConfirmationEmailAction } from '@/app/admin/actions';
import { scheduleEventReminder24HEmail, scheduleAppointmentDayReminderEmail } from '@/lib/scheduled-emails';
import { trackPaymentComplete } from '@/lib/facebook-pixel';

export default function StripeSuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(true);
  const [paymentType, setPaymentType] = useState<'advance' | 'final'>('advance');
  const bookingId = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const sessionId = searchParams.get('session_id');
  const isFinalPayment = searchParams.get('isFinalPayment') === 'true';

  useEffect(() => {
    if (bookingId && sessionId) {
      const updateBooking = async () => {
        try {
          // First, verify the Stripe session to ensure payment was completed
          const verifyRes = await fetch('/api/stripe/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });

          if (!verifyRes.ok) {
            const errorData = await verifyRes.json().catch(() => ({ error: 'Failed to verify payment' }));
            throw new Error(errorData.error || 'Payment verification failed');
          }

          const sessionData = await verifyRes.json();
          if (!sessionData.paid) {
            throw new Error('Payment was not completed');
          }

          // Verify the booking ID matches the session metadata
          if (sessionData.metadata?.bookingId !== bookingId) {
            throw new Error('Booking ID mismatch');
          }

          // Extract promotional code information (convert discount from cents to dollars)
          const promoCode = sessionData.promotionalCode || null;
          const promoCodeId = sessionData.promotionalCodeId || null;
          const couponId = sessionData.couponId || null;
          const discountAmount = sessionData.discountAmount ? sessionData.discountAmount / 100 : 0; // Convert from cents to dollars

          // Get tier from session metadata (for advance payment)
          const tierFromMetadata = sessionData.metadata?.tier as 'lead' | 'team' | undefined;

          // Fetch current booking
          const getRes = await fetch(`/api/bookings/${bookingId}`, { cache: 'no-store' });
          if (!getRes.ok) {
            throw new Error('Failed to fetch booking');
          }

          const { booking } = await getRes.json();
          const bookingDoc = booking;
          const finalQuote = bookingDoc.finalQuote || bookingDoc.final_quote;

          // Ensure selectedQuote is set - use from quote, metadata, or infer from payment amount
          let selectedQuote = finalQuote.selectedQuote || tierFromMetadata;
          if (!selectedQuote && finalQuote.quotes) {
            // Fallback: infer from payment amount if available
            const paymentAmount = sessionData.amount_total ? sessionData.amount_total / 100 : 0;
            if (paymentAmount > 0) {
              const leadAmount = finalQuote.quotes.lead?.total * 0.5 || 0;
              const teamAmount = finalQuote.quotes.team?.total * 0.5 || 0;
              // Find which tier matches the payment amount (with small tolerance for rounding)
              if (Math.abs(paymentAmount - leadAmount) < 1) {
                selectedQuote = 'lead';
              } else if (Math.abs(paymentAmount - teamAmount) < 1) {
                selectedQuote = 'team';
              }
            }
          }

          if (isFinalPayment) {
            setPaymentType('final');
            // Handle final payment - matches Interac flow: status = 'deposit-paid', send final payment confirmation email
            if (finalQuote && finalQuote.paymentDetails) {
              // Use selectedQuote from above (preserved or inferred)
              const quoteToUse = selectedQuote || finalQuote.selectedQuote || 'lead';
              const finalAmount = finalQuote.quotes[quoteToUse]?.total * 0.5 || 0;
              const updatedQuote = {
                ...finalQuote,
                selectedQuote: quoteToUse, // Ensure selectedQuote is set
                paymentDetails: {
                  ...finalQuote.paymentDetails,
                  finalPayment: {
                    ...finalQuote.paymentDetails.finalPayment, // Preserve existing finalPayment data if any
                    method: 'stripe',
                    status: 'deposit-paid',
                    amount: finalAmount,
                    transactionId: sessionId || undefined,
                    // Add promotional code data if used
                    promotionalCode: promoCode || undefined,
                    promotionalCodeId: promoCodeId || undefined,
                    couponId: couponId || undefined,
                    discountAmount: discountAmount > 0 ? discountAmount : undefined,
                  },
                },
              };

              const updateRes = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalQuote: updatedQuote }),
              });

              if (!updateRes.ok) {
                throw new Error('Failed to update booking');
              }
              
              // Send final payment confirmation email - same as Interac flow
              await sendFinalPaymentConfirmationEmailAction(bookingId);
              
              // Track payment completion
              trackPaymentComplete({
                bookingId: bookingId,
                amount: finalAmount,
                currency: 'CAD',
                paymentType: 'final',
                paymentMethod: 'stripe',
              });

              // Track promotional code usage if applied
              if (promoCode) {
                try {
                  const { trackEvent } = await import('@/lib/facebook-pixel');
                  trackEvent('PromoCodeUsed', {
                    booking_id: bookingId,
                    promo_code: promoCode,
                    discount_amount: discountAmount,
                    currency: 'CAD',
                    payment_type: 'final',
                  });
                } catch (trackingError) {
                  // Tracking should never block payment processing
                  console.warn('Failed to track promo code usage:', trackingError);
                }
              }
              
              toast({
                title: "Final Payment Successful!",
                description: "Your final payment has been processed. A confirmation email has been sent.",
                variant: 'default',
              });
            }
          } else {
            setPaymentType('advance');
            // Handle advance payment (deposit) - matches Interac flow: status = 'deposit-paid', send confirmation email
            if (finalQuote && finalQuote.paymentDetails?.status !== 'deposit-paid') {
              // Use selectedQuote from above (preserved or inferred)
              const quoteToUse = selectedQuote || finalQuote.selectedQuote || 'lead';
              const depositAmount = finalQuote.quotes[quoteToUse]?.total * 0.5 || 0;
              const updatedQuote = {
                ...finalQuote,
                status: 'confirmed',
                selectedQuote: quoteToUse, // Ensure selectedQuote is set
                paymentDetails: {
                  ...finalQuote.paymentDetails,
                  method: 'stripe',
                  status: 'deposit-paid',
                  depositAmount: depositAmount,
                  transactionId: sessionId || undefined, // Store transaction ID for advance payment
                  // Add promotional code data if used
                  promotionalCode: promoCode || undefined,
                  promotionalCodeId: promoCodeId || undefined,
                  couponId: couponId || undefined,
                  discountAmount: discountAmount > 0 ? discountAmount : undefined,
                },
              };

              // Update booking
              const updateRes = await fetch(`/api/bookings/${bookingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finalQuote: updatedQuote }),
              });

              if (!updateRes.ok) {
                throw new Error('Failed to update booking');
              }
              
              // Send confirmation email - same as Interac flow (sendQuoteEmail)
              toast({
                title: "Payment Successful!",
                description: "Your booking is confirmed. A confirmation email has been sent.",
                variant: 'default',
              });
              await sendConfirmationEmailAction(bookingId);
              
              // Track payment completion
              const advanceAmount = depositAmount;
              trackPaymentComplete({
                bookingId: bookingId,
                amount: advanceAmount,
                currency: 'CAD',
                paymentType: 'advance',
                paymentMethod: 'stripe',
              });

              // Track promotional code usage if applied
              if (promoCode) {
                try {
                  const { trackEvent } = await import('@/lib/facebook-pixel');
                  trackEvent('PromoCodeUsed', {
                    booking_id: bookingId,
                    promo_code: promoCode,
                    discount_amount: discountAmount,
                    currency: 'CAD',
                    payment_type: 'advance',
                  });
                } catch (trackingError) {
                  // Tracking should never block payment processing
                  console.warn('Failed to track promo code usage:', trackingError);
                }
              }
              
              // Schedule event reminder email 24 hours before the event
              await scheduleEventReminder24HEmail(updatedQuote);
              
              // Schedule appointment day reminder email 2.5 hours before appointment time
              await scheduleAppointmentDayReminderEmail(updatedQuote);
              
              // Schedule post-appointment follow-up email 6 hours after appointment time
              const { schedulePostAppointmentFollowupEmail } = await import('@/lib/scheduled-emails');
              await schedulePostAppointmentFollowupEmail(updatedQuote);
            }
          }
        } catch (error: any) {
          console.error("Failed to update booking after Stripe success:", error);
          toast({
            title: "Update Failed",
            description: error.message || `Your payment was successful, but we failed to update your booking. Please contact us with booking ID ${bookingId}.`,
            variant: "destructive",
          });
        } finally {
          setIsUpdating(false);
        }
      };

      updateBooking();
    } else {
      setIsUpdating(false);
    }
  }, [bookingId, sessionId, isFinalPayment, toast]);

  if (!bookingId || !sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <AlertTriangle className="w-12 h-12 text-destructive mt-4" />
        <h1 className="text-2xl font-bold text-destructive mt-4">Invalid Page Access</h1>
        <p className="mt-2 text-muted-foreground">This page was accessed incorrectly. Please return to your booking.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center flex-1 text-center p-4 sm:p-6">
        {isUpdating ? (
          <>
            <ShieldCheck className="h-20 w-20 text-green-500 animate-in fade-in zoom-in-50 duration-700" />
            <h1 className="text-3xl sm:text-4xl font-headline text-foreground mt-6">Payment Successful!</h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl">
              Thank you for your payment! We're processing your booking confirmation and preparing your details.
            </p>
            <Loader2 className="h-8 w-8 animate-spin text-black my-8" />
            <p className="text-sm text-muted-foreground">
              Please wait while we update your booking...
            </p>
          </>
        ) : (
          <>
            <div className="mb-6">
              <ShieldCheck className="h-24 w-24 text-green-500 animate-in fade-in zoom-in-50 duration-700 mx-auto" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-headline text-foreground mb-4">
              {paymentType === 'final' ? 'Payment Complete!' : 'Payment Confirmed!'}
            </h1>
            <div className="space-y-4 max-w-2xl mx-auto">
              <p className="text-lg sm:text-xl text-foreground font-medium">
                {paymentType === 'final' 
                  ? 'Your final payment has been successfully processed.'
                  : 'Your booking has been successfully confirmed.'}
              </p>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                {paymentType === 'final'
                  ? 'Thank you for completing your payment! Your booking is now fully paid and confirmed. A confirmation email with all the details has been sent to your email address.'
                  : 'We\'re thrilled to be part of your special day! A detailed confirmation email with all your booking information has been sent to your email address.'}
              </p>
              <div className="bg-muted/50 rounded-lg p-4 sm:p-6 mt-6 space-y-3 text-left">
                <p className="text-sm sm:text-base font-semibold text-foreground">
                  What happens next?
                </p>
                <ul className="space-y-2 text-sm sm:text-base text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-black mt-1">✓</span>
                    <span>Check your email for your booking confirmation and important details</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-black mt-1">✓</span>
                    <span>Save your booking ID: <span className="font-mono font-semibold text-foreground">{bookingId}</span></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-black mt-1">✓</span>
                    <span>We'll be in touch closer to your event date with any additional information</span>
                  </li>
                </ul>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mt-6">
                If you have any questions or need to make changes to your booking, please don't hesitate to contact us.
              </p>
            </div>
            <div className="mt-8">
              <Button asChild size="lg" className="text-base px-8 py-6">
                <Link href="/">
                  Return Home
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

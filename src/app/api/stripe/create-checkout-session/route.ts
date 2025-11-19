
import { NextResponse } from 'next/server';
import { getBooking } from '@/firebase/server-actions';
import Stripe from 'stripe';
import type { PriceTier } from '@/lib/types';

export async function POST(request: Request) {
  const { bookingId, tier, isFinalPayment, amount } = await request.json();

  if (!bookingId || (!tier && !isFinalPayment)) {
    return NextResponse.json({ error: 'Missing bookingId or tier' }, { status: 400 });
  }

  // Check if Stripe is configured
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY is not configured');
    return NextResponse.json({ 
      error: 'Stripe payment processing is not configured. Please contact support.' 
    }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

  try {
    let paymentAmount: number;
    let productName: string;
    let productDescription: string;

    if (isFinalPayment) {
      // Final payment (remaining 50%)
      paymentAmount = amount || 0;
      if (!paymentAmount) {
        const bookingDoc = await getBooking(bookingId);
        if (!bookingDoc) {
          return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }
        const selectedQuote = bookingDoc.finalQuote.quotes[bookingDoc.finalQuote.selectedQuote as PriceTier];
        paymentAmount = selectedQuote.total * 0.5;
      }
      productName = `Final Payment for Booking #${bookingId}`;
      productDescription = `50% final payment (remaining balance) for services from Looks by Anum.`;
    } else {
      // Advance payment (deposit)
      const bookingDoc = await getBooking(bookingId);
      if (!bookingDoc) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      const selectedQuote = bookingDoc.finalQuote.quotes[tier as PriceTier];
      if (!selectedQuote) {
        return NextResponse.json({ error: 'Invalid pricing tier selected' }, { status: 400 });
      }
      paymentAmount = selectedQuote.total * 0.5;
      productName = `Deposit for Booking #${bookingId}`;
      productDescription = `50% deposit for services from Looks by Anum.`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.round(paymentAmount * 100), // amount in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      allow_promotion_codes: true, // Enable promotional codes/coupons in checkout
      success_url: `${request.headers.get('origin')}/book/${bookingId}/success?session_id={CHECKOUT_SESSION_ID}${isFinalPayment ? '&isFinalPayment=true' : ''}`,
      cancel_url: `${request.headers.get('origin')}/book/${bookingId}/cancel`,
      metadata: {
        bookingId: bookingId,
        tier: tier || '',
        isFinalPayment: isFinalPayment ? 'true' : 'false',
      },
    });

    return NextResponse.json({ sessionId: session.id });

  } catch (err: any) {
    console.error('Stripe session creation error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

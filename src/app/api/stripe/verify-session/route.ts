import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Check if Stripe is configured
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ 
        error: 'Stripe payment processing is not configured' 
      }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session is paid
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        paid: false 
      }, { status: 400 });
    }

    // Return session details
    return NextResponse.json({
      paid: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      currency: session.currency,
      metadata: session.metadata,
    });

  } catch (err: any) {
    console.error('Stripe session verification error:', err.message);
    return NextResponse.json({ 
      error: err.message || 'Failed to verify session' 
    }, { status: 500 });
  }
}


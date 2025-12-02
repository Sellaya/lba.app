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

    // Retrieve the checkout session with expanded discount/promo code information
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['total_details.breakdown', 'discounts', 'discounts.promotion_code', 'discounts.coupon'],
    });

    // Verify the session is paid
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ 
        error: 'Payment not completed',
        paid: false 
      }, { status: 400 });
    }

    // Extract promotional code information
    // Type assertion needed because Stripe types may not fully reflect expanded properties
    // Use a more specific type instead of 'any' for better type safety
    const sessionWithDiscounts = session as Stripe.Checkout.Session & {
      discounts?: Array<{
        promotion_code?: Stripe.PromotionCode | string | null;
        coupon?: Stripe.Coupon | string | null;
      }>;
    };
    
    const discountAmount = session.total_details?.amount_discount || 0;
    const firstDiscount = sessionWithDiscounts.discounts?.[0];
    const promoCodeObj = firstDiscount?.promotion_code;
    const couponObj = firstDiscount?.coupon;
    
    const promoCode = typeof promoCodeObj === 'object' && promoCodeObj?.code 
      ? promoCodeObj.code 
      : null;
    const promoCodeId = typeof promoCodeObj === 'object' && promoCodeObj?.id 
      ? promoCodeObj.id 
      : null;
    const couponId = typeof couponObj === 'object' && couponObj?.id 
      ? couponObj.id 
      : null;

    // Return session details
    return NextResponse.json({
      paid: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      amountSubtotal: session.amount_subtotal,
      currency: session.currency,
      metadata: session.metadata,
      // Promotional code data
      promotionalCode: promoCode,
      promotionalCodeId: promoCodeId,
      couponId: couponId,
      discountAmount: discountAmount, // Amount in cents
    });

  } catch (err: any) {
    console.error('Stripe session verification error:', err.message);
    return NextResponse.json({ 
      error: err.message || 'Failed to verify session' 
    }, { status: 500 });
  }
}


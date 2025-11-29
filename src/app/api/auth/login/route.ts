import { NextResponse } from 'next/server';
import { verifyAdminCredentials, setSessionCookie, createSessionToken } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.LOGIN);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Verify credentials
    const isValid = await verifyAdminCredentials(email, password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = createSessionToken();
    await setSessionCookie(sessionToken);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}













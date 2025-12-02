import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { getBaseUrl } from '@/lib/base-url';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function POST(request: Request) {
  // Apply rate limiting (same as login - 5 requests per 15 minutes)
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.LOGIN);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Only allow password reset for the admin email
    if (email !== ADMIN_EMAIL) {
      // Don't reveal that the email doesn't exist - return success anyway for security
      return NextResponse.json({ 
        success: true,
        message: 'If that email exists, a password reset link has been sent.'
      });
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store the token in the database
    const { error: dbError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        email,
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: false,
      });

    if (dbError) {
      console.error('Error storing reset token:', dbError);
      
      // Check if table doesn't exist
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('relation') || dbError.message?.includes('schema cache')) {
        return NextResponse.json(
          { 
            error: 'Password reset table not found. Please create the password_reset_tokens table in your database.',
            errorCode: 'TABLE_NOT_FOUND',
            sqlScript: `
-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;
            `
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to process password reset request: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Generate reset link
    const baseUrl = getBaseUrl();
    const resetLink = `${baseUrl}/admin/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetLink);
    } catch (emailError: any) {
      console.error('Error sending password reset email:', emailError);
      // Return error so user knows email wasn't sent
      return NextResponse.json(
        { 
          error: `Failed to send password reset email: ${emailError.message || 'Email service error'}. Please check your email configuration (RESEND_API_KEY).`,
          errorCode: 'EMAIL_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'If that email exists, a password reset link has been sent.'
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}


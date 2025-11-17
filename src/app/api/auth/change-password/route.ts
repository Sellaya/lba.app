import { NextResponse } from 'next/server';
import { verifyAdminCredentials, hashPassword, isAuthenticated, updateAdminPasswordHash } from '@/lib/auth';
import { ADMIN_EMAIL } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Check if user is authenticated
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyAdminCredentials(ADMIN_EMAIL, currentPassword);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password hash in database
    const updated = await updateAdminPasswordHash(ADMIN_EMAIL, newPasswordHash);

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update password. Please try again or contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'An error occurred while changing password' },
      { status: 500 }
    );
  }
}


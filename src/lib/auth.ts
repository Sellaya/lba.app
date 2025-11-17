import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

// Admin email
export const ADMIN_EMAIL = 'info@looksbyanum.com';

// Session configuration
const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify a password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a session token
export function createSessionToken(): string {
  return Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');
}

// Set session cookie
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
}

// Get session token from cookie
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Get admin password hash from database
async function getAdminPasswordHash(email: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_auth')
      .select('password_hash')
      .eq('email', email)
      .single();

    if (error || !data) {
      // Fallback to hardcoded hash if table doesn't exist yet
      if (email === ADMIN_EMAIL) {
        return '$2b$10$afIBXgLbyCqr40PcU9Bgy.nX5UMQNzpiOzQN1EOSCAhvTx8Lr9STO';
      }
      return null;
    }

    return data.password_hash;
  } catch (error) {
    // Fallback to hardcoded hash if database query fails
    if (email === ADMIN_EMAIL) {
      return '$2b$10$afIBXgLbyCqr40PcU9Bgy.nX5UMQNzpiOzQN1EOSCAhvTx8Lr9STO';
    }
    return null;
  }
}

// Verify admin credentials
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  if (email !== ADMIN_EMAIL) {
    return false;
  }
  
  const passwordHash = await getAdminPasswordHash(email);
  if (!passwordHash) {
    return false;
  }
  
  return verifyPassword(password, passwordHash);
}

// Update admin password hash in database
export async function updateAdminPasswordHash(email: string, newPasswordHash: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('admin_auth')
      .upsert({
        email,
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      });

    if (error) {
      console.error('Error updating password hash:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating password hash:', error);
    return false;
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken();
  return token !== null;
}


import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is an admin route
  if (pathname.startsWith('/admin')) {
    // Allow access to login, forgot password, and reset password pages
    if (pathname === '/admin/login' || pathname === '/admin/forgot-password' || pathname === '/admin/reset-password') {
      return NextResponse.next();
    }

    // Check for admin session cookie
    const sessionCookie = request.cookies.get('admin_session');

    // If no session cookie, redirect to login
    if (!sessionCookie) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
};


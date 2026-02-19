import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, shouldBypassRateLimit } from './lib/rate-limit';
import { csrfProtection, shouldBypassCSRF } from './lib/csrf';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip all middleware for WebSocket connections (/ws/ endpoints)
  if (pathname.startsWith('/ws/')) {
    return NextResponse.next();
  }
  
  // Apply rate limiting
  if (!shouldBypassRateLimit(request)) {
    let rateLimitResponse = null;
    
    // Apply specific rate limiters based on route
    if (pathname.startsWith('/api/auth')) {
      rateLimitResponse = await rateLimiters.auth(request);
    } else if (pathname.startsWith('/api/auth/password-reset')) {
      rateLimitResponse = await rateLimiters.passwordReset(request);
    } else if (pathname.startsWith('/api/')) {
      rateLimitResponse = await rateLimiters.api(request);
    }
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }
  
  // Apply CSRF protection for API routes
  if (pathname.startsWith('/api/') && !shouldBypassCSRF(pathname)) {
    const csrfResponse = await csrfProtection(request);
    if (csrfResponse) {
      return csrfResponse;
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

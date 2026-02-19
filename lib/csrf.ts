import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

/**
 * Set CSRF token in cookie
 */
export async function setCSRFToken() {
  const token = generateCSRFToken();
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: true,
    // Use ENABLE_SECURE_COOKIES to require Secure cookies behind HTTPS/proxies.
    secure: process.env.ENABLE_SECURE_COOKIES === 'true',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return token;
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(CSRF_TOKEN_COOKIE);
  return cookie?.value || null;
}

/**
 * Verify CSRF token
 */
export async function verifyCSRFToken(request: NextRequest): Promise<boolean> {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }
  
  const cookieToken = await getCSRFToken();
  const headerToken = request.headers.get(CSRF_HEADER);
  
  if (!cookieToken || !headerToken) {
    // Log missing tokens for debugging (safe to log presence only)
    try {
      console.warn('CSRF verification failed: cookiePresent=', !!cookieToken, 'headerPresent=', !!headerToken, 'path=', request.nextUrl?.pathname || request.url);
    } catch (e) { }
    return false;
  }
  
  return cookieToken === headerToken;
}

/**
 * CSRF protection middleware
 */
export async function csrfProtection(request: NextRequest) {
  const isValid = await verifyCSRFToken(request);
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
  }
  
  return null;
}

/**
 * Routes that should bypass CSRF protection
 */
const csrfExceptions = new Set<string>([
  '/api/auth/signup',
  '/api/auth/login',
  '/api/health',
  '/api/status',
  '/api/webhook', // External webhooks
]);

/**
 * Check if route should bypass CSRF protection
 */
export function shouldBypassCSRF(pathname: string): boolean {
  return csrfExceptions.has(pathname);
}

/**
 * Add route to CSRF exception list
 */
export function addCSRFException(route: string) {
  csrfExceptions.add(route);
}

/**
 * Remove route from CSRF exception list
 */
export function removeCSRFException(route: string) {
  csrfExceptions.delete(route);
}

/**
 * Get all CSRF exceptions
 */
export function getCSRFExceptions(): string[] {
  return Array.from(csrfExceptions);
}

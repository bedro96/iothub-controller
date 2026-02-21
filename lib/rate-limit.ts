import { NextRequest, NextResponse } from 'next/server';

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  message: 'Too many requests, please try again later',
};

/**
 * Rate limiting middleware
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  
  return async (request: NextRequest) => {
    // Get client identifier (IP address)
    // Note: NextRequest.ip is not in types but exists at runtime in some environments
    const identifier = (request as any).ip || request.headers.get('x-forwarded-for') || 'unknown';
    const key = `ratelimit:${identifier}:${request.nextUrl.pathname}`;
    
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      // Create new record
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + finalConfig.windowMs,
      });
      return null; // Allow request
    }
    
    if (record.count >= finalConfig.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        { error: finalConfig.message },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': record.resetTime.toString(),
          },
        }
      );
    }
    
    // Increment counter
    record.count++;
    rateLimitStore.set(key, record);
    
    return null; // Allow request
  };
}

/**
 * Cleanup expired rate limit records
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up every 5 minutes
// Only run in server environment (Node.js has 'process' but browsers don't)
// Note: cleanup interval is started in Node environments only.
// The Node-specific starter lives in `lib/rate-limit-node.ts` so this
// module remains Edge-runtime compatible for use in `middleware.ts`.

/**
 * Rate limiter configurations for different routes
 */
export const rateLimiters = {
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 login attempts
    message: 'Too many authentication attempts, please try again later',
  }),
  api: createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }),
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts, please try again later',
  }),
};

/**
 * Allowlist for rate limiting exceptions
 */
const rateLimitAllowlist = new Set<string>([
  // Add IPs or routes that should bypass rate limiting
  '127.0.0.1',
  '::1',
]);

/**
 * Check if request should bypass rate limiting
 */
export function shouldBypassRateLimit(request: NextRequest): boolean {
  // Note: NextRequest.ip is not in types but exists at runtime in some environments
  const ip = (request as any).ip || request.headers.get('x-forwarded-for');
  
  // Check IP allowlist
  if (ip && rateLimitAllowlist.has(ip)) {
    return true;
  }
  
  // Check if route is in allowlist (e.g., health checks)
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/health' || pathname === '/api/status') {
    return true;
  }
  
  // Check for internal service token (optional).
  // For Edge runtime compatibility we don't compare against process.env here.
  // If you need an internal bypass, handle it in server-side code only.
  
  return false;
}

/**
 * Add IP to rate limit allowlist
 */
export function addToAllowlist(ip: string) {
  rateLimitAllowlist.add(ip);
}

/**
 * Remove IP from rate limit allowlist
 */
export function removeFromAllowlist(ip: string) {
  rateLimitAllowlist.delete(ip);
}

/**
 * Get current allowlist
 */
export function getAllowlist(): string[] {
  return Array.from(rateLimitAllowlist);
}

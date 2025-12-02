import { NextResponse } from 'next/server';

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

/**
 * In-memory store for rate limiting
 * Note: In production with multiple instances, use Redis/Upstash
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    return this.store.get(key);
  }

  set(key: string, value: { count: number; resetTime: number }): void {
    this.store.set(key, value);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.resetTime < now) {
      // Create new entry or reset expired entry
      const newEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Get client identifier from request
 */
function getClientId(request: Request): string {
  // Try to get IP address from headers (Vercel provides this)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  // Also include path for per-endpoint limiting
  const url = new URL(request.url);
  return `${ip}:${url.pathname}`;
}

/**
 * Rate limit middleware
 * Returns null if request is allowed, or NextResponse with error if rate limited
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig
): NextResponse | null {
  const clientId = getClientId(request);
  const result = store.increment(clientId, config.windowMs);

  if (result.count > config.maxRequests) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    
    return NextResponse.json(
      {
        error: config.message || 'Too many requests, please try again later.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        },
      }
    );
  }

  // Add rate limit headers to successful requests
  const remaining = Math.max(0, config.maxRequests - result.count);
  return null; // Request is allowed
}

/**
 * Rate limit wrapper for API routes
 * Usage: const response = await withRateLimit(request, config);
 *        if (response) return response; // Rate limited
 */
export async function withRateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  return rateLimit(request, config);
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Login endpoint: 5 attempts per 15 minutes
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
  // Booking creation: 10 requests per minute
  BOOKING_CREATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many booking requests. Please try again in a minute.',
  },
  // File uploads: 20 requests per minute
  FILE_UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many file uploads. Please try again in a minute.',
  },
  // General API: 100 requests per minute
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests. Please try again in a minute.',
  },
} as const;



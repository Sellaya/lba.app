# Rate Limiting Implementation - Security Fix #5

## Overview
Implemented rate limiting to protect critical API endpoints from brute force attacks, DoS, and resource exhaustion.

## Implementation Details

### Rate Limiter Utility (`src/lib/rate-limit.ts`)
- **In-memory store**: Uses Map-based storage with automatic cleanup
- **Client identification**: Uses IP address + pathname for per-endpoint limiting
- **Configurable limits**: Predefined configurations for different endpoint types
- **Standard headers**: Returns proper HTTP 429 with Retry-After headers

### Rate Limit Configurations

| Endpoint Type | Window | Max Requests | Use Case |
|--------------|--------|--------------|----------|
| **LOGIN** | 15 minutes | 5 | Login, password reset endpoints |
| **FILE_UPLOAD** | 1 minute | 20 | File upload endpoints |
| **BOOKING_CREATE** | 1 minute | 10 | Booking creation (for future use) |
| **GENERAL** | 1 minute | 100 | General API endpoints |

## Protected Endpoints

### Authentication Endpoints
- ✅ `/api/auth/login` - 5 attempts per 15 minutes
- ✅ `/api/auth/forgot-password` - 5 attempts per 15 minutes
- ✅ `/api/auth/reset-password` - 5 attempts per 15 minutes
- ✅ `/api/auth/change-password` - 5 attempts per 15 minutes

### File Upload Endpoints
- ✅ `/api/bookings/[bookingId]/upload-screenshot` - 20 uploads per minute
- ✅ `/api/bookings/[bookingId]/upload-inspiration` - 20 uploads per minute
- ✅ `/api/bookings/[bookingId]/upload-makeup-photos` - 20 uploads per minute

## Response Format

When rate limited, endpoints return:
```json
{
  "error": "Too many requests, please try again later.",
  "retryAfter": 900
}
```

With HTTP headers:
- `Retry-After: 900` (seconds until retry allowed)
- `X-RateLimit-Limit: 5` (max requests per window)
- `X-RateLimit-Remaining: 0` (remaining requests)
- `X-RateLimit-Reset: 2024-01-01T12:00:00.000Z` (reset time)

## Usage Example

```typescript
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // Apply rate limiting
  const rateLimitResponse = await withRateLimit(request, RATE_LIMITS.LOGIN);
  if (rateLimitResponse) {
    return rateLimitResponse; // Return 429 if rate limited
  }

  // Continue with normal request handling
  // ...
}
```

## Production Considerations

### Current Implementation
- **In-memory storage**: Works for single-instance deployments
- **Automatic cleanup**: Expired entries cleaned every 5 minutes
- **IP-based limiting**: Uses `x-forwarded-for` or `x-real-ip` headers

### For Multi-Instance Deployments
The current implementation uses in-memory storage, which works for single-instance deployments. For production with multiple serverless instances, consider upgrading to:

1. **Redis/Upstash** (Recommended):
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";
   
   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(5, "15 m"),
   });
   ```

2. **Vercel Edge Config** or **Supabase** for shared state

## Security Benefits

1. **Brute Force Protection**: Login endpoints protected from password guessing
2. **DoS Mitigation**: Prevents resource exhaustion from excessive requests
3. **Abuse Prevention**: File upload limits prevent storage abuse
4. **Cost Control**: Limits API costs from excessive usage

## Testing

To test rate limiting:
1. Make 5+ requests to `/api/auth/login` within 15 minutes
2. 6th request should return HTTP 429 with `Retry-After` header
3. Wait for window to expire or check `X-RateLimit-Reset` header

## Future Enhancements

- [ ] Add Redis/Upstash integration for multi-instance support
- [ ] Add rate limiting to booking creation endpoints
- [ ] Add per-user rate limiting (not just IP-based)
- [ ] Add rate limit monitoring/logging
- [ ] Add whitelist for trusted IPs

## Files Modified

- `src/lib/rate-limit.ts` (new file)
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`
- `src/app/api/auth/change-password/route.ts`
- `src/app/api/bookings/[bookingId]/upload-screenshot/route.ts`
- `src/app/api/bookings/[bookingId]/upload-inspiration/route.ts`
- `src/app/api/bookings/[bookingId]/upload-makeup-photos/route.ts`



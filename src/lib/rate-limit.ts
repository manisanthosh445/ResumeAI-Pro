interface RateLimitEntry {
  count: number
  resetTime: number
}

// Global in-memory storage across requests in the Node process
const store = new Map<string, RateLimitEntry>()

/**
 * Basic in-memory rate limiter.
 * Default: 5 attempts per 15 minutes.
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetTime <= now) {
    store.set(key, { count: 1, resetTime: now + windowMs })
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetInSec: Math.ceil(windowMs / 1000),
    }
  }

  if (entry.count >= maxAttempts) {
    const resetInSec = Math.max(1, Math.ceil((entry.resetTime - now) / 1000))
    return {
      allowed: false,
      remaining: 0,
      resetInSec,
    }
  }

  entry.count += 1
  const resetInSec = Math.max(1, Math.ceil((entry.resetTime - now) / 1000))
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetInSec,
  }
}

/**
 * Resets or clears a specific rate limit key (e.g. after successful login).
 */
export function clearRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Extracts client IP from standard request headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return '127.0.0.1'
}

import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple in-memory IP-based rate limiter.
 * For production scale, consider using Upstash Redis (@upstash/ratelimit).
 *
 * This is intentionally basic: it uses a sliding window stored in a Map.
 * The Map is per-process, so in serverless environments each cold start
 * gets a fresh Map. This provides baseline protection against bursts
 * without external dependencies.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

/**
 * Check rate limit for a request.
 *
 * @param request - The incoming request (used to extract IP)
 * @param opts.limit - Max requests per window (default: 10)
 * @param opts.windowMs - Window duration in ms (default: 60_000 = 1 minute)
 * @param opts.key - Optional key prefix for scoping (e.g. 'generate', 'publish')
 * @returns null if allowed, or a NextResponse with 429 status if rate limited
 */
export function rateLimit(
  request: NextRequest,
  opts: { limit?: number; windowMs?: number; key?: string } = {}
): NextResponse | null {
  const { limit = 10, windowMs = 60_000, key = 'global' } = opts
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1'

  const storeKey = `${key}:${ip}`
  const now = Date.now()

  cleanup()

  const entry = store.get(storeKey)

  if (!entry || now > entry.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  return null
}

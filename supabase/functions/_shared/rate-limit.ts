interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key)
  }
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

export function checkRateLimit(
  req: Request,
  opts: { limit?: number; windowMs?: number; key?: string } = {}
): { allowed: boolean; retryAfter?: number } {
  const { limit = 10, windowMs = 60_000, key = 'global' } = opts
  const storeKey = `${key}:${getClientIp(req)}`
  const now = Date.now()

  cleanup()

  const current = store.get(storeKey)
  if (!current || now > current.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  current.count += 1
  if (current.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    }
  }

  return { allowed: true }
}

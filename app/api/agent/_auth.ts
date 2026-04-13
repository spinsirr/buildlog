import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * Constant-time comparison for the shared AGENT_API_SECRET header.
 * Prevents timing attacks that could leak secret bytes one char at a time.
 *
 * Returns null on success, or a 401 response on failure.
 */
export function verifyAgentSecret(req: Request): NextResponse | null {
  const provided = req.headers.get('x-agent-secret') ?? ''
  const expected = process.env.AGENT_API_SECRET ?? ''

  if (!expected) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Pad to equal length so timingSafeEqual doesn't short-circuit on length mismatch
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  const len = Math.max(a.length, b.length)
  const aPad = Buffer.concat([a, Buffer.alloc(len - a.length)], len)
  const bPad = Buffer.concat([b, Buffer.alloc(len - b.length)], len)

  if (a.length !== b.length || !timingSafeEqual(aPad, bPad)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

import { NextResponse } from 'next/server'

/**
 * Verify internal API calls from Supabase Edge Functions.
 * Uses a shared secret to prevent unauthorized external access.
 *
 * The secret should be set as AI_INTERNAL_SECRET in both:
 * - Vercel environment (for the API route to read)
 * - Supabase Edge Function secrets (for the caller to send)
 */
export function verifyInternalAuth(request: Request): NextResponse | null {
  const secret = process.env.AI_INTERNAL_SECRET
  if (!secret) {
    // No secret configured — allow all requests (development mode)
    return null
  }

  const provided = request.headers.get('x-ai-internal-secret')
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

import { NextResponse } from 'next/server'
import { decide } from '@/lib/ai/decision'
import { decisionInputSchema } from '@/lib/ai/schemas'
import { verifyInternalAuth } from '../_auth'

export async function POST(request: Request) {
  const authError = verifyInternalAuth(request)
  if (authError) return authError

  const body = await request.json()
  const parsed = decisionInputSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    const decision = await decide(parsed.data)
    return NextResponse.json(decision)
  } catch (err) {
    console.error('Decision engine error:', err)
    // Fail-open: return default decision on error
    return NextResponse.json({
      decision: 'post',
      reason: 'Decision engine error — defaulting to post',
      confidence: 'low',
      angle: null,
    })
  }
}

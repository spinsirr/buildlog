import { NextResponse } from 'next/server'
import { processEvent } from '@/lib/ai/engine'
import { processInputSchema } from '@/lib/ai/schemas'
import { verifyInternalAuth } from '../_auth'

export async function POST(request: Request) {
  const authError = verifyInternalAuth(request)
  if (authError) return authError

  const body = await request.json()
  const parsed = processInputSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    const result = await processEvent(parsed.data)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Process pipeline error:', err)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

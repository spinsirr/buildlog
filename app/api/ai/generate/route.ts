import { NextResponse } from 'next/server'
import { generate } from '@/lib/ai/generate'
import { generateInputSchema } from '@/lib/ai/schemas'
import { verifyInternalAuth } from '../_auth'

export async function POST(request: Request) {
  const authError = verifyInternalAuth(request)
  if (authError) return authError

  const body = await request.json()
  const parsed = generateInputSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 }
    )
  }

  try {
    const content = await generate(parsed.data)
    return NextResponse.json({ content })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

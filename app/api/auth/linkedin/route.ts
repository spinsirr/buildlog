import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { checkLimit } from '@/lib/subscription'

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'LinkedIn not configured' }, { status: 503 })
  }

  // Enforce platform limit
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { allowed, limit } = await checkLimit(user.id, 'platforms', supabase)
  if (!allowed) {
    return NextResponse.json(
      { error: `Platform limit reached (${limit}). Upgrade to Pro to connect more platforms.` },
      { status: 403 }
    )
  }

  const state = base64url(crypto.randomBytes(16))

  const cookieStore = await cookies()
  cookieStore.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/linkedin/callback`,
    state,
    scope: 'openid profile w_member_social',
  })

  return NextResponse.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params}` })
}

import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin
  const clientId = process.env.TWITTER_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'Twitter not configured' }, { status: 503 })
  }

  // PKCE
  const codeVerifier = base64url(crypto.randomBytes(32))
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  )
  const state = base64url(crypto.randomBytes(16))

  const cookieStore = await cookies()
  cookieStore.set('twitter_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 min
    path: '/',
  })
  cookieStore.set('twitter_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${origin}/auth/twitter/callback`,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return NextResponse.redirect(`https://twitter.com/i/oauth2/authorize?${params}`)
}

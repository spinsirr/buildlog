import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard?error=twitter_denied`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get('twitter_oauth_state')?.value
  const codeVerifier = cookieStore.get('twitter_code_verifier')?.value

  cookieStore.delete('twitter_oauth_state')
  cookieStore.delete('twitter_code_verifier')

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    return NextResponse.redirect(`${origin}/dashboard?error=twitter_invalid_state`)
  }

  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/auth/twitter/callback`,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    console.error('Twitter token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(`${origin}/dashboard?error=twitter_token_failed`)
  }

  const tokens = await tokenRes.json()

  // Fetch user info
  const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  const { data: twitterUser } = await userRes.json()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await supabase.from('platform_connections').upsert({
    user_id: user.id,
    platform: 'twitter',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    platform_user_id: twitterUser?.id ?? null,
    platform_username: twitterUser?.username ?? null,
    expires_at: expiresAt,
  }, { onConflict: 'user_id,platform' })

  return NextResponse.redirect(`${origin}/dashboard?connected=twitter`)
}

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
    return NextResponse.redirect(`${origin}/settings?error=linkedin_denied`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get('linkedin_oauth_state')?.value

  cookieStore.delete('linkedin_oauth_state')

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/settings?error=linkedin_invalid_state`)
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!

  // Exchange code for tokens
  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/auth/linkedin/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    console.error('LinkedIn token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(`${origin}/settings?error=linkedin_token_failed`)
  }

  const tokens = await tokenRes.json()

  // Fetch user info using OpenID userinfo endpoint
  const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  const linkedinUser = userRes.ok ? await userRes.json() : null

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
    platform: 'linkedin',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    platform_user_id: linkedinUser?.sub ?? null,
    platform_username: linkedinUser?.name ?? null,
    expires_at: expiresAt,
  }, { onConflict: 'user_id,platform' })

  return NextResponse.redirect(`${origin}/settings?connected=linkedin`)
}

// deno-lint-ignore-file camelcase
import { decrypt, encrypt, toBase64Utf8 } from './crypto.ts'
import { createServiceClient } from './supabase.ts'

interface TwitterTokens {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('TWITTER_CLIENT_ID')
  const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Twitter OAuth configuration')
  }

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${toBase64Utf8(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Twitter token refresh failed: ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  const supabase = createServiceClient()
  await supabase
    .from('platform_connections')
    .update({
      access_token: await encrypt(data.access_token),
      refresh_token: await encrypt(data.refresh_token ?? refreshToken),
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
    })
    .eq('user_id', userId)
    .eq('platform', 'twitter')

  return data.access_token
}

async function getValidToken(userId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from('platform_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('platform', 'twitter')
    .single()

  if (!conn) throw new Error('Twitter not connected')

  const tokens = conn as TwitterTokens

  if (tokens.expires_at && tokens.refresh_token) {
    const expiresAt = new Date(tokens.expires_at).getTime()
    const bufferMs = 5 * 60 * 1000

    if (Date.now() > expiresAt - bufferMs) {
      return refreshAccessToken(userId, await decrypt(tokens.refresh_token))
    }
  }

  return decrypt(tokens.access_token)
}

export async function publishToTwitter(
  userId: string,
  text: string
): Promise<{ tweetId: string; tweetUrl: string }> {
  const accessToken = await getValidToken(userId)

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Twitter API error: ${res.status} ${body}`)
  }

  const payload = (await res.json()) as { data: { id: string } }

  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from('platform_connections')
    .select('platform_username')
    .eq('user_id', userId)
    .eq('platform', 'twitter')
    .single()

  const username = conn?.platform_username ?? 'i'

  return {
    tweetId: payload.data.id,
    tweetUrl: `https://x.com/${username}/status/${payload.data.id}`,
  }
}

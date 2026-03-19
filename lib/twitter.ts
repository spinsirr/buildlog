import { createServiceClient } from '@/lib/supabase/service'

interface TwitterTokens {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
  const clientId = process.env.TWITTER_CLIENT_ID!
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
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

  const data = await res.json()

  const supabase = createServiceClient()
  await supabase
    .from('platform_connections')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
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

  // If token expires within 5 minutes, refresh it
  if (tokens.expires_at && tokens.refresh_token) {
    const expiresAt = new Date(tokens.expires_at).getTime()
    const bufferMs = 5 * 60 * 1000
    if (Date.now() > expiresAt - bufferMs) {
      return refreshAccessToken(userId, tokens.refresh_token)
    }
  }

  return tokens.access_token
}

export async function publishToTwitter(userId: string, text: string): Promise<{ tweetId: string; tweetUrl: string }> {
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

  const { data } = await res.json()

  // Get username for URL
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from('platform_connections')
    .select('platform_username')
    .eq('user_id', userId)
    .eq('platform', 'twitter')
    .single()

  const username = conn?.platform_username ?? 'i'
  return {
    tweetId: data.id,
    tweetUrl: `https://x.com/${username}/status/${data.id}`,
  }
}

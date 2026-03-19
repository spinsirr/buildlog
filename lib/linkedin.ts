import { createServiceClient } from '@/lib/supabase/service'

async function getValidToken(userId: string): Promise<{ accessToken: string; linkedinUserId: string }> {
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from('platform_connections')
    .select('access_token, platform_user_id, expires_at')
    .eq('user_id', userId)
    .eq('platform', 'linkedin')
    .single()

  if (!conn) throw new Error('LinkedIn not connected')

  // LinkedIn access tokens are long-lived (60 days) and don't have refresh flow
  // for the basic 3-legged OAuth. Check expiry.
  if (conn.expires_at) {
    const expiresAt = new Date(conn.expires_at).getTime()
    if (Date.now() > expiresAt) {
      throw new Error('LinkedIn token expired. Please reconnect in Settings.')
    }
  }

  if (!conn.platform_user_id) {
    throw new Error('LinkedIn user ID not found. Please reconnect in Settings.')
  }

  return {
    accessToken: conn.access_token,
    linkedinUserId: conn.platform_user_id,
  }
}

export async function publishToLinkedIn(
  userId: string,
  text: string
): Promise<{ postId: string; postUrl: string }> {
  const { accessToken, linkedinUserId } = await getValidToken(userId)

  // Use the LinkedIn Posts API (v2)
  const res = await fetch('https://api.linkedin.com/v2/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    body: JSON.stringify({
      author: `urn:li:person:${linkedinUserId}`,
      commentary: text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn API error: ${res.status} ${body}`)
  }

  // LinkedIn returns the post URN in the x-restli-id header
  const postUrn = res.headers.get('x-restli-id') ?? ''
  // Extract the activity ID from the URN for the URL
  const activityId = postUrn.split(':').pop() ?? postUrn

  return {
    postId: postUrn,
    postUrl: `https://www.linkedin.com/feed/update/${postUrn.includes(':') ? postUrn : `urn:li:share:${activityId}`}`,
  }
}

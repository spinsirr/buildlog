import { decrypt } from './crypto.ts'
import { createServiceClient } from './supabase.ts'

async function getCredentials(userId: string): Promise<{ handle: string; appPassword: string }> {
  const supabase = createServiceClient()

  const { data: conn } = await supabase
    .from('platform_connections')
    .select('access_token, platform_username')
    .eq('user_id', userId)
    .eq('platform', 'bluesky')
    .single()

  if (!conn) throw new Error('Bluesky not connected')

  if (!conn.platform_username || !conn.access_token) {
    throw new Error('Bluesky credentials missing. Please reconnect in Settings.')
  }

  return {
    handle: conn.platform_username,
    appPassword: await decrypt(conn.access_token),
  }
}

export async function publishToBluesky(
  userId: string,
  text: string
): Promise<{ postUri: string; postUrl: string }> {
  const { handle, appPassword } = await getCredentials(userId)

  const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  })

  if (!sessionRes.ok) {
    const body = await sessionRes.text()
    throw new Error(`Bluesky session failed: ${sessionRes.status} ${body}`)
  }

  const session = (await sessionRes.json()) as { did: string; accessJwt: string }

  const postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
      },
    }),
  })

  if (!postRes.ok) {
    const body = await postRes.text()
    throw new Error(`Bluesky API error: ${postRes.status} ${body}`)
  }

  const { uri } = (await postRes.json()) as { uri: string }
  const rkey = uri.split('/').pop() ?? ''

  return {
    postUri: uri,
    postUrl: `https://bsky.app/profile/${handle}/post/${rkey}`,
  }
}

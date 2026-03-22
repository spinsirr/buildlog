import { requireUser } from '../_shared/auth.ts'
import { errorResponse, handleOptions, jsonResponse } from '../_shared/cors.ts'
import { safeJson } from '../_shared/http.ts'
import { createServiceClient } from '../_shared/supabase.ts'

async function getInstallationToken(installationId: number): Promise<string> {
  const appId = Deno.env.get('GITHUB_APP_ID')
  const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')
  if (!appId || !privateKey) throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY')

  // Create JWT for GitHub App auth
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  const payload = btoa(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Import private key and sign
  const pemContent = privateKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigData = new TextEncoder().encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, sigData)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  const jwt = `${header}.${payload}.${sig}`

  // Exchange JWT for installation token
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub installation token failed: ${res.status} ${body}`)
  }

  const data = (await res.json()) as { token: string }
  return data.token
}

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, req)
  }

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const body = await safeJson<{
    action?: string
    installation_id?: number
  }>(req)

  const action = body?.action ?? 'set-installation'
  const supabase = createServiceClient()

  if (action === 'set-installation') {
    if (!body?.installation_id) {
      return errorResponse('Missing installation_id', 400, req)
    }

    const { error } = await supabase
      .from('profiles')
      .update({ github_installation_id: body.installation_id })
      .eq('id', user.id)

    if (error) return errorResponse(error.message, 500, req)
    return jsonResponse({ ok: true }, req)
  }

  if (action === 'list-repos') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('github_installation_id')
      .eq('id', user.id)
      .single()

    if (!profile?.github_installation_id) {
      return jsonResponse({ repos: [], needsInstall: true }, req)
    }

    try {
      const token = await getInstallationToken(profile.github_installation_id)

      const res = await fetch('https://api.github.com/installation/repositories?per_page=100', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!res.ok) {
        console.error('[github-app] list repos failed:', await res.text())
        return jsonResponse({ repos: [], needsInstall: true }, req)
      }

      const data = (await res.json()) as {
        repositories: {
          id: number
          full_name: string
          private: boolean
          description: string | null
        }[]
      }

      // Get connected repos
      const { data: connectedRepos } = await supabase
        .from('connected_repos')
        .select('github_repo_id')
        .eq('user_id', user.id)

      const connectedIds = new Set(
        connectedRepos?.map((r: { github_repo_id: number }) => r.github_repo_id) ?? []
      )

      const repos = data.repositories.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        private: repo.private,
        description: repo.description,
        connected: connectedIds.has(repo.id),
      }))

      return jsonResponse({ repos, needsInstall: false }, req)
    } catch (err) {
      console.error('[github-app] list repos error:', err)
      return jsonResponse({ repos: [], needsInstall: true }, req)
    }
  }

  return errorResponse('Unknown action', 400, req)
})

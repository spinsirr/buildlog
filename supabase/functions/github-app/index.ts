import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { safeJson } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"

await setupLogger()
const log = getLog("github-app")

async function getInstallationToken(installationId: number): Promise<string> {
  const appId = Deno.env.get("GITHUB_APP_ID")
  const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY")
  if (!appId || !privateKey) throw new Error("Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY")

  // Create JWT for GitHub App auth
  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  const payload = btoa(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  // Import private key and sign
  const pemContent = privateKey
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "")
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const sigData = new TextEncoder().encode(`${header}.${payload}`)
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, sigData)
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  const jwt = `${header}.${payload}.${sig}`

  // Exchange JWT for installation token
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
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

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const body = await safeJson<{
    action?: string
    installation_id?: number
    repo_full_name?: string
  }>(req)

  const action = body?.action ?? "set-installation"

  if (action === "set-installation") {
    if (!body?.installation_id) {
      return errorResponse("Missing installation_id", 400, req)
    }

    const { error } = await supabase
      .from("profiles")
      .update({ github_installation_id: body.installation_id })
      .eq("id", user.id)

    if (error) return errorResponse(error.message, 500, req)
    return jsonResponse({ ok: true }, req)
  }

  if (action === "list-repos") {
    log.info("list-repos for user {userId}", { userId: user.id })

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("github_installation_id")
      .eq("id", user.id)
      .single()

    log.info("profile query result: installationId={installationId}, error={error}", {
      installationId: profile?.github_installation_id,
      error: profileErr?.message,
    })

    if (!profile?.github_installation_id) {
      return jsonResponse({ repos: [], needsInstall: true }, req)
    }

    try {
      log.info("getting installation token for {installationId}", {
        installationId: profile.github_installation_id,
      })
      const token = await getInstallationToken(profile.github_installation_id)
      log.info("got installation token OK")

      const res = await fetch("https://api.github.com/installation/repositories?per_page=100", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })

      if (!res.ok) {
        const errText = await res.text()
        log.error("list repos failed: {status} {body}", { status: res.status, body: errText })
        return errorResponse(`GitHub API error: ${res.status} ${errText}`, 502, req)
      }

      const data = (await res.json()) as {
        repositories: {
          id: number
          full_name: string
          private: boolean
          description: string | null
          pushed_at: string | null
        }[]
      }

      // Get connected repos
      const { data: connectedRepos } = await supabase
        .from("connected_repos")
        .select("github_repo_id, watched_branches")
        .eq("user_id", user.id)

      const connectedMap = new Map(
        connectedRepos?.map((r: { github_repo_id: number; watched_branches: string[] | null }) => [
          r.github_repo_id,
          r.watched_branches,
        ]) ?? [],
      )

      const repos = data.repositories
        .map((repo) => ({
          id: repo.id,
          full_name: repo.full_name,
          private: repo.private,
          description: repo.description,
          connected: connectedMap.has(repo.id),
          pushed_at: repo.pushed_at,
          watched_branches: connectedMap.get(repo.id) ?? null,
        }))
        .sort((a, b) => {
          if (!a.pushed_at) return 1
          if (!b.pushed_at) return -1
          return new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime()
        })

      return jsonResponse({ repos, needsInstall: false }, req)
    } catch (err) {
      log.error("list repos error: {error}", {
        error: (err as Error).message,
        stack: (err as Error).stack,
      })
      return errorResponse(`Failed to list repos: ${(err as Error).message}`, 500, req)
    }
  }

  if (action === "list-branches") {
    if (!body?.repo_full_name) {
      return errorResponse("Missing repo_full_name", 400, req)
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("github_installation_id")
      .eq("id", user.id)
      .single()

    if (!profile?.github_installation_id) {
      return errorResponse("No GitHub installation", 400, req)
    }

    try {
      const token = await getInstallationToken(profile.github_installation_id)
      const res = await fetch(
        `https://api.github.com/repos/${body.repo_full_name}/branches?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      )

      if (!res.ok) {
        const errText = await res.text()
        return errorResponse(`GitHub API error: ${res.status} ${errText}`, 502, req)
      }

      const branches = (await res.json()) as { name: string; protected: boolean }[]
      return jsonResponse(
        { branches: branches.map((b) => ({ name: b.name, protected: b.protected })) },
        req,
      )
    } catch (err) {
      return errorResponse(`Failed to list branches: ${(err as Error).message}`, 500, req)
    }
  }

  return errorResponse("Unknown action", 400, req)
})

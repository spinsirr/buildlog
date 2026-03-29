import { getLog } from "./logger.ts"

const log = getLog("github")

function decodePemFromEnv(): string {
  const raw = Deno.env.get("GITHUB_APP_PRIVATE_KEY") ?? ""
  if (raw.startsWith("-----BEGIN")) {
    return raw.replace(/\\n/g, "\n")
  }
  return new TextDecoder().decode(
    Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
  )
}

export async function generateAppJwt(): Promise<string> {
  const appId = Deno.env.get("GITHUB_APP_ID")
  if (!appId) throw new Error("Missing GITHUB_APP_ID")

  const pem = decodePemFromEnv()
  if (!pem || !pem.includes("PRIVATE KEY")) {
    throw new Error("GITHUB_APP_PRIVATE_KEY missing or invalid after decode")
  }

  const now = Math.floor(Date.now() / 1000)
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  const payload = btoa(JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")

  const pemContent = pem
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
  return `${header}.${payload}.${sig}`
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = await generateAppJwt()
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

export interface FileDiff {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

export interface PrContext {
  commitMessages: string[]
  files: string[]
  diffs: FileDiff[]
}

/**
 * Fetch commit messages and changed file paths for a PR.
 * Best-effort: returns partial data if API calls fail.
 */
export async function fetchPrContext(
  installationId: number,
  repoFullName: string,
  prNumber: number,
): Promise<PrContext> {
  const result: PrContext = { commitMessages: [], files: [], diffs: [] }

  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get installation token for PR context: {error}", { error: String(err) })
    return result
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Fetch commits and files in parallel
  const [commitsRes, filesRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/commits?per_page=50`, {
      headers,
    }),
    fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=100`, {
      headers,
    }),
  ])

  if (commitsRes.status === "fulfilled" && commitsRes.value.ok) {
    const commits = (await commitsRes.value.json()) as Array<{
      commit: { message: string }
    }>
    result.commitMessages = commits.map((c) => c.commit.message.split("\n")[0])
  } else {
    log.warn("failed to fetch PR commits")
  }

  if (filesRes.status === "fulfilled" && filesRes.value.ok) {
    const files = (await filesRes.value.json()) as Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      patch?: string
    }>
    result.files = files.map((f) => f.filename)
    // Keep diffs under ~12KB total to avoid bloating the AI prompt
    let totalPatchSize = 0
    const MAX_PATCH_BUDGET = 12_000
    for (const f of files) {
      const patchLen = f.patch?.length ?? 0
      if (totalPatchSize + patchLen > MAX_PATCH_BUDGET && result.diffs.length > 0) break
      result.diffs.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch?.slice(0, 3000), // cap individual file patch
      })
      totalPatchSize += Math.min(patchLen, 3000)
    }
  } else {
    log.warn("failed to fetch PR files")
  }

  return result
}

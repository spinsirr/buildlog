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
  const payload = btoa(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: appId }),
  )
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

export async function getInstallationToken(
  installationId: number,
): Promise<string> {
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
export interface TagContext {
  commitMessages: string[]
  files: string[]
  diffs: FileDiff[]
  previousTag?: string
}

/**
 * Fetch commits and diffs between this tag and the previous tag.
 * Falls back to comparing against the first commit if no previous tag exists.
 */
export async function fetchTagContext(
  installationId: number,
  repoFullName: string,
  tagName: string,
): Promise<TagContext> {
  const result: TagContext = { commitMessages: [], files: [], diffs: [] }

  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get installation token for tag context: {error}", {
      error: String(err),
    })
    return result
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Find the previous tag to compare against
  try {
    const tagsRes = await fetch(
      `https://api.github.com/repos/${repoFullName}/tags?per_page=10`,
      { headers },
    )
    if (tagsRes.ok) {
      const tags = (await tagsRes.json()) as Array<{ name: string }>
      const tagNames = tags.map((t) => t.name)
      const currentIdx = tagNames.indexOf(tagName)
      const previousTag = currentIdx >= 0 && currentIdx < tagNames.length - 1
        ? tagNames[currentIdx + 1]
        : null

      if (previousTag) {
        result.previousTag = previousTag
        // Compare previous tag to this tag
        const compareRes = await fetch(
          `https://api.github.com/repos/${repoFullName}/compare/${previousTag}...${tagName}`,
          { headers },
        )
        if (compareRes.ok) {
          const compare = (await compareRes.json()) as {
            commits: Array<{ commit: { message: string } }>
            files: Array<{
              filename: string
              status: string
              additions: number
              deletions: number
              patch?: string
            }>
          }
          result.commitMessages = compare.commits.map((c) => c.commit.message.split("\n")[0])
          result.files = compare.files.map((f) => f.filename)

          // Keep diffs under ~12KB total
          let totalPatchSize = 0
          const MAX_PATCH_BUDGET = 12_000
          for (const f of compare.files) {
            const patchLen = f.patch?.length ?? 0
            if (
              totalPatchSize + patchLen > MAX_PATCH_BUDGET &&
              result.diffs.length > 0
            ) break
            result.diffs.push({
              filename: f.filename,
              status: f.status,
              additions: f.additions,
              deletions: f.deletions,
              patch: f.patch?.slice(0, 3000),
            })
            totalPatchSize += Math.min(patchLen, 3000)
          }
        }
      } else {
        // No previous tag — get the tag's commit and show recent commits
        const commitRes = await fetch(
          `https://api.github.com/repos/${repoFullName}/commits?sha=${tagName}&per_page=10`,
          { headers },
        )
        if (commitRes.ok) {
          const commits = (await commitRes.json()) as Array<
            { commit: { message: string } }
          >
          result.commitMessages = commits.map((c) => c.commit.message.split("\n")[0])
        }
      }
    }
  } catch (err) {
    log.warn("failed to fetch tag context: {error}", { error: String(err) })
  }

  return result
}

/**
 * Fetch repo README + manifest files to build a project context string.
 * Used at connect time to give AI better understanding of the project.
 */
export async function fetchRepoContext(
  installationId: number,
  repoFullName: string,
): Promise<string | null> {
  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get token for repo context: {error}", {
      error: String(err),
    })
    return null
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  const parts: string[] = []

  // Fetch README (try common names)
  for (const name of ["README.md", "README", "readme.md"]) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${name}`,
        { headers: { ...headers, Accept: "application/vnd.github.raw+json" } },
      )
      if (res.ok) {
        const text = await res.text()
        // Take first ~2000 chars of README — enough for description + overview
        const trimmed = text.slice(0, 2000)
        parts.push(`README:\n${trimmed}`)
        break
      }
    } catch {
      // continue to next name
    }
  }

  // Fetch manifest files for tech stack info
  const manifests = [
    "package.json",
    "deno.json",
    "deno.jsonc",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
  ]
  for (const name of manifests) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repoFullName}/contents/${name}`,
        { headers: { ...headers, Accept: "application/vnd.github.raw+json" } },
      )
      if (res.ok) {
        const text = await res.text()
        // Only keep first ~500 chars — we just need name, description, deps overview
        parts.push(`${name}:\n${text.slice(0, 500)}`)
        break // one manifest is enough
      }
    } catch {
      // continue
    }
  }

  if (parts.length === 0) return null
  return parts.join("\n\n")
}

export interface CommitContext {
  commitMessages: string[]
  files: string[]
  diffs: FileDiff[]
}

/**
 * Fetch commit messages, file paths, and real diffs for a push event.
 * Uses the compare API (before...head) which returns the cumulative diff
 * across all commits in the push — one API call regardless of commit count.
 *
 * Handles new-branch pushes (before = all zeros) by falling back to a
 * single-commit fetch against the head SHA.
 *
 * Best-effort: returns partial data if API calls fail.
 */
export async function fetchCommitContext(
  installationId: number,
  repoFullName: string,
  beforeSha: string,
  headSha: string,
): Promise<CommitContext> {
  const result: CommitContext = { commitMessages: [], files: [], diffs: [] }

  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get installation token for commit context: {error}", {
      error: String(err),
    })
    return result
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  const isFirstPush = /^0+$/.test(beforeSha)
  const MAX_PATCH_BUDGET = 12_000
  const MAX_FILE_PATCH = 3_000

  try {
    if (isFirstPush) {
      // New branch / first push — no "before" to compare against.
      // Fetch just the head commit's files.
      const res = await fetch(
        `https://api.github.com/repos/${repoFullName}/commits/${headSha}`,
        { headers },
      )
      if (!res.ok) return result

      const commit = (await res.json()) as {
        commit: { message: string }
        files?: Array<{
          filename: string
          status: string
          additions: number
          deletions: number
          patch?: string
        }>
      }
      result.commitMessages = [commit.commit.message.split("\n")[0]]
      result.files = commit.files?.map((f) => f.filename) ?? []

      let totalPatchSize = 0
      for (const f of commit.files ?? []) {
        const patchLen = f.patch?.length ?? 0
        if (
          totalPatchSize + patchLen > MAX_PATCH_BUDGET &&
          result.diffs.length > 0
        ) break
        result.diffs.push({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch?.slice(0, MAX_FILE_PATCH),
        })
        totalPatchSize += Math.min(patchLen, MAX_FILE_PATCH)
      }
      return result
    }

    // Normal push — compare cumulative diff across all commits
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/compare/${beforeSha}...${headSha}`,
      { headers },
    )
    if (!res.ok) return result

    const compare = (await res.json()) as {
      commits: Array<{ commit: { message: string } }>
      files?: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        patch?: string
      }>
    }
    result.commitMessages = compare.commits.map((c) => c.commit.message.split("\n")[0])
    result.files = compare.files?.map((f) => f.filename) ?? []

    let totalPatchSize = 0
    for (const f of compare.files ?? []) {
      const patchLen = f.patch?.length ?? 0
      if (
        totalPatchSize + patchLen > MAX_PATCH_BUDGET && result.diffs.length > 0
      ) break
      result.diffs.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch?.slice(0, MAX_FILE_PATCH),
      })
      totalPatchSize += Math.min(patchLen, MAX_FILE_PATCH)
    }
  } catch (err) {
    log.warn("failed to fetch commit context: {error}", { error: String(err) })
  }

  return result
}

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
    log.warn("failed to get installation token for PR context: {error}", {
      error: String(err),
    })
    return result
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Fetch commits and files in parallel
  const [commitsRes, filesRes] = await Promise.allSettled([
    fetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/commits?per_page=50`,
      {
        headers,
      },
    ),
    fetch(
      `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=100`,
      {
        headers,
      },
    ),
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
      if (
        totalPatchSize + patchLen > MAX_PATCH_BUDGET && result.diffs.length > 0
      ) break
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

// ---------------------------------------------------------------------------
// Recap data fetchers — used by generate-recap to pull GitHub activity
// ---------------------------------------------------------------------------

export interface RecentCommit {
  sha: string
  message: string
  author: string
  date: string
}

export async function fetchRecentCommits(
  installationId: number,
  repoFullName: string,
  since: string,
  branch?: string,
): Promise<RecentCommit[]> {
  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get token for recent commits: {error}", {
      error: String(err),
    })
    return []
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  try {
    const params = new URLSearchParams({ since, per_page: "30" })
    if (branch) params.set("sha", branch)
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/commits?${params}`,
      { headers },
    )
    if (!res.ok) {
      log.warn("failed to fetch commits for {repo}: {status}", {
        repo: repoFullName,
        status: String(res.status),
      })
      return []
    }
    const commits = (await res.json()) as Array<{
      sha: string
      commit: {
        message: string
        author: { name: string; date: string } | null
      }
    }>
    return commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
    }))
  } catch (err) {
    log.warn("error fetching commits for {repo}: {error}", {
      repo: repoFullName,
      error: String(err),
    })
    return []
  }
}

export interface MergedPr {
  number: number
  title: string
  "merged_at": string
  additions: number
  deletions: number
}

export async function fetchMergedPrs(
  installationId: number,
  repoFullName: string,
  since: string,
): Promise<MergedPr[]> {
  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get token for merged PRs: {error}", {
      error: String(err),
    })
    return []
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/pulls?state=closed&sort=updated&direction=desc&per_page=20`,
      { headers },
    )
    if (!res.ok) {
      log.warn("failed to fetch PRs for {repo}: {status}", {
        repo: repoFullName,
        status: String(res.status),
      })
      return []
    }
    const prs = (await res.json()) as Array<{
      number: number
      title: string
      merged_at: string | null
      additions?: number
      deletions?: number
    }>
    return prs
      .filter((pr) => pr.merged_at && pr.merged_at >= since)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        merged_at: pr.merged_at!,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
      }))
  } catch (err) {
    log.warn("error fetching PRs for {repo}: {error}", {
      repo: repoFullName,
      error: String(err),
    })
    return []
  }
}

export interface RecentRelease {
  "tag_name": string
  name: string
  "published_at": string
  body: string | null
}

export async function fetchRecentReleases(
  installationId: number,
  repoFullName: string,
  since: string,
): Promise<RecentRelease[]> {
  let token: string
  try {
    token = await getInstallationToken(installationId)
  } catch (err) {
    log.warn("failed to get token for releases: {error}", {
      error: String(err),
    })
    return []
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoFullName}/releases?per_page=5`,
      { headers },
    )
    if (!res.ok) {
      log.warn("failed to fetch releases for {repo}: {status}", {
        repo: repoFullName,
        status: String(res.status),
      })
      return []
    }
    const releases = (await res.json()) as Array<{
      tag_name: string
      name: string | null
      published_at: string | null
      body: string | null
    }>
    return releases
      .filter((r) => r.published_at && r.published_at >= since)
      .map((r) => ({
        tag_name: r.tag_name,
        name: r.name ?? r.tag_name,
        published_at: r.published_at!,
        body: r.body?.slice(0, 500) ?? null,
      }))
  } catch (err) {
    log.warn("error fetching releases for {repo}: {error}", {
      repo: repoFullName,
      error: String(err),
    })
    return []
  }
}

export interface RepoRecapData {
  repoName: string
  commits: RecentCommit[]
  mergedPrs: MergedPr[]
  releases: RecentRelease[]
}

export async function fetchRepoRecapData(
  installationId: number,
  repoFullName: string,
  since: string,
  branch?: string,
): Promise<RepoRecapData> {
  const result: RepoRecapData = {
    repoName: repoFullName,
    commits: [],
    mergedPrs: [],
    releases: [],
  }

  const promises = [
    fetchRecentCommits(installationId, repoFullName, since, branch),
    branch ? Promise.resolve([]) : fetchMergedPrs(installationId, repoFullName, since),
    branch ? Promise.resolve([]) : fetchRecentReleases(installationId, repoFullName, since),
  ] as const

  const [commitsResult, prsResult, releasesResult] = await Promise.allSettled(
    promises,
  )

  if (commitsResult.status === "fulfilled") {
    result.commits = commitsResult.value
  }
  if (prsResult.status === "fulfilled") {
    result.mergedPrs = prsResult.value as MergedPr[]
  }
  if (releasesResult.status === "fulfilled") {
    result.releases = releasesResult.value as RecentRelease[]
  }

  return result
}

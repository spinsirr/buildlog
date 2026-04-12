export const recapToneInstructions: Record<string, string> = {
  casual: 'Use a friendly, conversational tone. Sound like a developer tweeting to friends.',
  professional:
    'Use a polished, professional tone. Sound like a founder giving a confident product update.',
  technical: 'Use a technical tone with specifics. Sound like a senior engineer sharing knowledge.',
}

// --- Types for internal data (bundle_later decisions + published posts) ---

export interface BundleDecision {
  id: string
  source_type: string
  source_data: Record<string, unknown>
  reason: string
  angle: string | null
  created_at: string
}

export interface RecapPost {
  id: string
  content: string
  source_type: string
  source_data: Record<string, unknown> | null
  created_at: string
}

// --- Types for GitHub activity data ---

export interface RecapCommit {
  message: string
  author: string
}

export interface RecapPr {
  number: number
  title: string
  additions: number
  deletions: number
}

export interface RecapRelease {
  tag_name: string
  name: string
  body: string | null
}

export interface RepoRecapActivity {
  repoName: string
  commits: RecapCommit[]
  mergedPrs: RecapPr[]
  releases: RecapRelease[]
}

export type RecapMode = 'week' | 'branch'

// --- Prompt builders ---

export function buildRecapSystemPrompt(
  tone: string,
  charLimit: number,
  mode: RecapMode = 'week'
): string {
  const modeFraming =
    mode === 'branch'
      ? `You are writing a social media post about progress on a specific feature branch. Focus on what was built, the progression of work, and the end result.`
      : `You are writing a weekly recap for a developer's "build in public" social media. Weave all activity into a coherent narrative about what was shipped this week.`

  return `${modeFraming}

TONE:
${recapToneInstructions[tone] ?? recapToneInstructions.casual}

CRITICAL RULES:
- MUST be under ${charLimit} characters
- ${mode === 'branch' ? 'Focus on the feature story — what problem it solves, what changed' : 'Highlight the overall theme or direction of the week'}
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are merged PRs, prefer talking about those over individual commits
- ${mode === 'branch' ? 'This is about ONE feature branch — keep it focused' : 'This is a WEEKLY SUMMARY, not individual updates'}

Output ONLY the post text, nothing else.`
}

const MAX_COMMITS_PER_REPO = 15

export function buildRecapUserPrompt(
  repoData: RepoRecapActivity[],
  bundles: BundleDecision[],
  posts: RecapPost[],
  mode: RecapMode = 'week',
  projectContexts?: Map<string, string>
): string {
  const parts: string[] = []

  // --- Primary: GitHub activity ---
  const reposWithData = repoData.filter(
    (r) => r.commits.length > 0 || r.mergedPrs.length > 0 || r.releases.length > 0
  )

  if (reposWithData.length > 0) {
    const header = mode === 'branch' ? 'BRANCH ACTIVITY:' : 'GITHUB ACTIVITY THIS WEEK:'
    const repoSections = reposWithData.map((repo) => {
      const lines: string[] = [`## ${repo.repoName}`]

      const ctx = projectContexts?.get(repo.repoName)
      if (ctx) lines.push(ctx)

      // Filter merge commits, cap at limit
      const filteredCommits = repo.commits
        .filter((c) => !c.message.startsWith('Merge '))
        .slice(0, MAX_COMMITS_PER_REPO)

      if (filteredCommits.length > 0) {
        lines.push(`\nCommits (${filteredCommits.length}):`)
        for (const c of filteredCommits) {
          lines.push(`- ${c.message} (by ${c.author})`)
        }
      }

      if (repo.mergedPrs.length > 0) {
        lines.push(`\nMerged PRs (${repo.mergedPrs.length}):`)
        for (const pr of repo.mergedPrs) {
          lines.push(`- PR #${pr.number}: ${pr.title} (+${pr.additions} -${pr.deletions})`)
        }
      }

      if (repo.releases.length > 0) {
        lines.push(`\nReleases (${repo.releases.length}):`)
        for (const r of repo.releases) {
          const desc = r.body ? ` — ${r.body.slice(0, 200)}` : ''
          lines.push(`- ${r.tag_name}: ${r.name}${desc}`)
        }
      }

      return lines.join('\n')
    })

    parts.push(`${header}\n\n${repoSections.join('\n\n')}`)
  }

  // --- Secondary: internal data ---
  if (bundles.length > 0) {
    const bundleLines = bundles.map((b) => {
      const msg = (b.source_data?.message ?? b.source_data?.title ?? 'unknown change') as string
      return `- [${b.source_type}] ${msg} — reason deferred: "${b.reason}"${b.angle ? ` (angle: ${b.angle})` : ''}`
    })
    parts.push(
      `BUNDLED EVENTS (deferred from individual posts, not yet shared publicly):\n${bundleLines.join('\n')}`
    )
  }

  if (posts.length > 0) {
    const postLines = posts.map((p) => `- "${p.content}"`)
    parts.push(`ALREADY SHARED THIS WEEK:\n${postLines.join('\n')}`)
  }

  // --- Instruction ---
  const instruction =
    mode === 'branch'
      ? 'Generate ONE post summarizing what was built on this branch.'
      : 'Generate ONE weekly recap post that covers the full week.'
  parts.push(instruction)

  return parts.join('\n\n')
}

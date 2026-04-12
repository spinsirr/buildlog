import { describe, expect, it } from 'vitest'
import {
  type BundleDecision,
  buildRecapSystemPrompt,
  buildRecapUserPrompt,
  type RecapPost,
  type RepoRecapActivity,
} from '@/lib/recap-prompts'

// --- Fixtures ---

const mockBundle: BundleDecision = {
  id: '1',
  source_type: 'commit',
  source_data: { message: 'feat: add CSV export' },
  reason: 'meaningful but incomplete',
  angle: 'data export feature',
  created_at: '2026-04-10T00:00:00Z',
}

const mockPost: RecapPost = {
  id: '2',
  content: 'Shipped dark mode for the dashboard. #buildinpublic',
  source_type: 'commit',
  source_data: null,
  created_at: '2026-04-09T00:00:00Z',
}

const mockRepoActivity: RepoRecapActivity = {
  repoName: 'spinsirr/buildlog',
  commits: [
    { message: 'feat: add weekly recap button', author: 'spenc' },
    { message: 'fix: correct char limit for x_premium', author: 'spenc' },
    { message: 'Merge branch main into feat/recap', author: 'spenc' },
  ],
  mergedPrs: [{ number: 7, title: 'Weekly Recap v1', additions: 513, deletions: 10 }],
  releases: [],
}

const mockRepoWithRelease: RepoRecapActivity = {
  repoName: 'spinsirr/cli-tool',
  commits: [{ message: 'perf: parallel file processing', author: 'spenc' }],
  mergedPrs: [],
  releases: [
    { tag_name: 'v2.0.0', name: 'v2.0.0 — Parallel processing', body: 'Major perf update' },
  ],
}

// --- System prompt tests ---

describe('buildRecapSystemPrompt', () => {
  it('includes char limit in system prompt', () => {
    const prompt = buildRecapSystemPrompt('casual', 280)
    expect(prompt).toContain('under 280 characters')
  })

  it('uses x_premium char limit', () => {
    const prompt = buildRecapSystemPrompt('casual', 4000)
    expect(prompt).toContain('under 4000 characters')
  })

  it('includes casual tone instructions', () => {
    const prompt = buildRecapSystemPrompt('casual', 280)
    expect(prompt).toContain('friendly, conversational')
  })

  it('includes professional tone instructions', () => {
    const prompt = buildRecapSystemPrompt('professional', 280)
    expect(prompt).toContain('polished, professional')
  })

  it('includes technical tone instructions', () => {
    const prompt = buildRecapSystemPrompt('technical', 280)
    expect(prompt).toContain('technical tone')
  })

  it('falls back to casual for unknown tone', () => {
    const prompt = buildRecapSystemPrompt('unknown', 280)
    expect(prompt).toContain('friendly, conversational')
  })

  it('uses weekly framing by default', () => {
    const prompt = buildRecapSystemPrompt('casual', 280)
    expect(prompt).toContain('weekly recap')
    expect(prompt).toContain('WEEKLY SUMMARY')
  })

  it('uses branch framing when mode is branch', () => {
    const prompt = buildRecapSystemPrompt('casual', 280, 'branch')
    expect(prompt).toContain('feature branch')
    expect(prompt).toContain('ONE feature branch')
    expect(prompt).not.toContain('WEEKLY SUMMARY')
  })
})

// --- User prompt tests ---

describe('buildRecapUserPrompt', () => {
  describe('with internal data only (v1 compat)', () => {
    it('includes bundles section when bundles exist', () => {
      const prompt = buildRecapUserPrompt([], [mockBundle], [])
      expect(prompt).toContain('BUNDLED EVENTS')
      expect(prompt).toContain('feat: add CSV export')
      expect(prompt).toContain('meaningful but incomplete')
    })

    it('includes angle in bundle line when present', () => {
      const prompt = buildRecapUserPrompt([], [mockBundle], [])
      expect(prompt).toContain('(angle: data export feature)')
    })

    it('omits angle when null', () => {
      const noAngle = { ...mockBundle, angle: null }
      const prompt = buildRecapUserPrompt([], [noAngle], [])
      expect(prompt).not.toContain('(angle:')
    })

    it('includes published posts section when posts exist', () => {
      const prompt = buildRecapUserPrompt([], [], [mockPost])
      expect(prompt).toContain('ALREADY SHARED THIS WEEK')
      expect(prompt).toContain('Shipped dark mode')
    })

    it('includes both sections when both exist', () => {
      const prompt = buildRecapUserPrompt([], [mockBundle], [mockPost])
      expect(prompt).toContain('BUNDLED EVENTS')
      expect(prompt).toContain('ALREADY SHARED THIS WEEK')
    })

    it('handles empty data gracefully', () => {
      const prompt = buildRecapUserPrompt([], [], [])
      expect(prompt).toContain('Generate ONE weekly recap post')
      expect(prompt).not.toContain('BUNDLED EVENTS')
      expect(prompt).not.toContain('ALREADY SHARED')
      expect(prompt).not.toContain('GITHUB ACTIVITY')
    })

    it('uses title fallback when message is missing', () => {
      const prBundle = { ...mockBundle, source_data: { title: 'Fix login bug' } }
      const prompt = buildRecapUserPrompt([], [prBundle], [])
      expect(prompt).toContain('Fix login bug')
    })
  })

  describe('with GitHub activity data', () => {
    it('includes GitHub activity header for week mode', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [])
      expect(prompt).toContain('GITHUB ACTIVITY THIS WEEK:')
      expect(prompt).toContain('## spinsirr/buildlog')
    })

    it('includes commits with author', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [])
      expect(prompt).toContain('feat: add weekly recap button (by spenc)')
    })

    it('filters out merge commits', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [])
      expect(prompt).not.toContain('Merge branch main')
    })

    it('includes merged PRs with stats', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [])
      expect(prompt).toContain('PR #7: Weekly Recap v1 (+513 -10)')
    })

    it('includes releases', () => {
      const prompt = buildRecapUserPrompt([mockRepoWithRelease], [], [])
      expect(prompt).toContain('v2.0.0: v2.0.0 — Parallel processing')
      expect(prompt).toContain('Major perf update')
    })

    it('handles multiple repos', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity, mockRepoWithRelease], [], [])
      expect(prompt).toContain('## spinsirr/buildlog')
      expect(prompt).toContain('## spinsirr/cli-tool')
    })

    it('skips repos with no activity', () => {
      const emptyRepo: RepoRecapActivity = {
        repoName: 'spinsirr/empty',
        commits: [],
        mergedPrs: [],
        releases: [],
      }
      const prompt = buildRecapUserPrompt([emptyRepo, mockRepoActivity], [], [])
      expect(prompt).not.toContain('## spinsirr/empty')
      expect(prompt).toContain('## spinsirr/buildlog')
    })

    it('includes project context when provided', () => {
      const contexts = new Map([['spinsirr/buildlog', 'A build-in-public SaaS tool']])
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [], 'week', contexts)
      expect(prompt).toContain('A build-in-public SaaS tool')
    })

    it('combines GitHub data with internal data', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [mockBundle], [mockPost])
      expect(prompt).toContain('GITHUB ACTIVITY THIS WEEK:')
      expect(prompt).toContain('BUNDLED EVENTS')
      expect(prompt).toContain('ALREADY SHARED THIS WEEK')
    })

    it('caps commits at 15 per repo', () => {
      const manyCommits: RepoRecapActivity = {
        repoName: 'spinsirr/busy-repo',
        commits: Array.from({ length: 20 }, (_, i) => ({
          message: `commit ${i + 1}`,
          author: 'dev',
        })),
        mergedPrs: [],
        releases: [],
      }
      const prompt = buildRecapUserPrompt([manyCommits], [], [])
      expect(prompt).toContain('commit 15')
      expect(prompt).not.toContain('commit 16')
    })
  })

  describe('branch mode', () => {
    it('uses branch activity header', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [], 'branch')
      expect(prompt).toContain('BRANCH ACTIVITY:')
      expect(prompt).not.toContain('GITHUB ACTIVITY THIS WEEK')
    })

    it('uses branch-specific instruction', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [], 'branch')
      expect(prompt).toContain('Generate ONE post summarizing what was built on this branch')
    })

    it('uses weekly instruction by default', () => {
      const prompt = buildRecapUserPrompt([mockRepoActivity], [], [])
      expect(prompt).toContain('Generate ONE weekly recap post')
    })
  })
})

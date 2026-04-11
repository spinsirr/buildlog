/**
 * Agent test fixtures — realistic GitHub events for testing decision quality.
 *
 * Events are categorized as "should_post" vs "should_skip" so we can
 * measure precision/recall of the agent's decisions.
 */

import type { AgentEvent } from '@/lib/agent/types'

const BASE: Pick<
  AgentEvent,
  'userId' | 'repoId' | 'repoName' | 'tone' | 'autoPublish' | 'xPremium' | 'projectContext'
> = {
  userId: 'test-user-1',
  repoId: 'test-repo-1',
  repoName: 'acme/widget-app',
  tone: 'casual',
  autoPublish: false,
  xPremium: false,
  projectContext:
    'Widget App is a React dashboard for managing e-commerce widgets. Uses Next.js, Supabase, Stripe.',
}

// ─── Should POST events ───────────────────────────────────────────────

export const FEATURE_COMMIT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'feat: add bulk export to CSV for inventory management',
    files: ['app/dashboard/export.tsx', 'lib/csv-generator.ts', 'components/export-dialog.tsx'],
    additions: 287,
    deletions: 12,
    filesChanged: 3,
  },
}

export const BUG_FIX_COMMIT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'fix: resolve race condition in checkout causing duplicate charges',
    files: ['lib/stripe/checkout.ts', 'app/api/webhooks/stripe.ts'],
    additions: 45,
    deletions: 23,
    filesChanged: 2,
  },
}

export const PERFORMANCE_COMMIT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'perf: optimize dashboard queries — 3x faster page load',
    files: ['lib/db/queries.ts', 'app/dashboard/page.tsx'],
    additions: 89,
    deletions: 156,
    filesChanged: 2,
  },
}

export const FEATURE_PR: AgentEvent = {
  ...BASE,
  sourceType: 'pr',
  data: {
    title: 'feat: add dark mode with system preference detection',
    description:
      'Implements dark mode across the dashboard with automatic system preference detection. Uses CSS variables for theme tokens.',
    files: ['styles/globals.css', 'components/theme-provider.tsx', 'app/layout.tsx'],
    additions: 412,
    deletions: 28,
    filesChanged: 8,
    commitMessages: [
      'feat: add theme provider with system detection',
      'style: convert dashboard to CSS variables',
      'style: update all component themes',
      'fix: flash of unstyled content on first load',
    ],
  },
}

export const RELEASE: AgentEvent = {
  ...BASE,
  sourceType: 'release',
  data: {
    title: 'v2.0.0',
    description:
      'Major release: new dashboard, CSV export, dark mode, improved checkout flow. See changelog for details.',
    additions: 2400,
    deletions: 890,
    filesChanged: 47,
  },
}

export const UI_IMPROVEMENT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'feat: redesign settings page with tabbed layout and search',
    files: [
      'app/dashboard/settings/page.tsx',
      'components/settings/tabs.tsx',
      'components/settings/search.tsx',
    ],
    additions: 334,
    deletions: 198,
    filesChanged: 5,
  },
}

// ─── Should SKIP events ───────────────────────────────────────────────

export const LINT_FIX: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'style: fix linting errors and format with prettier',
    files: ['src/utils.ts', 'src/components/button.tsx', '.prettierrc'],
    additions: 12,
    deletions: 14,
    filesChanged: 3,
  },
}

export const DEPENDENCY_BUMP: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'chore: bump next from 15.2.0 to 15.2.1',
    files: ['package.json', 'bun.lockb'],
    additions: 3,
    deletions: 3,
    filesChanged: 2,
  },
}

export const CI_CONFIG: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'ci: update GitHub Actions runner to ubuntu-22.04',
    files: ['.github/workflows/ci.yml'],
    additions: 1,
    deletions: 1,
    filesChanged: 1,
  },
}

export const TYPO_FIX: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'fix: typo in README',
    files: ['README.md'],
    additions: 1,
    deletions: 1,
    filesChanged: 1,
  },
}

export const MERGE_COMMIT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: "Merge branch 'feature/dark-mode' into main",
    files: [],
    additions: 0,
    deletions: 0,
    filesChanged: 0,
  },
}

export const REFACTOR_INTERNAL: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'refactor: extract error handling into shared utility',
    files: ['lib/errors/handler.ts', 'lib/errors/types.ts', 'lib/api/client.ts'],
    additions: 67,
    deletions: 45,
    filesChanged: 3,
  },
}

export const LOCKFILE_UPDATE: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'chore: update bun.lockb',
    files: ['bun.lockb'],
    additions: 50,
    deletions: 48,
    filesChanged: 1,
  },
}

// ─── Edge cases ───────────────────────────────────────────────────────

export const BIG_REFACTOR: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'refactor: restructure entire API layer for v2 migration',
    files: [
      'lib/api/client.ts',
      'lib/api/auth.ts',
      'lib/api/types.ts',
      'lib/api/middleware.ts',
      'lib/api/index.ts',
    ],
    additions: 890,
    deletions: 1200,
    filesChanged: 5,
  },
}

export const VAGUE_COMMIT: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  data: {
    message: 'wip',
    files: ['src/app.ts'],
    additions: 42,
    deletions: 8,
    filesChanged: 1,
  },
}

export const TECHNICAL_TONE: AgentEvent = {
  ...BASE,
  sourceType: 'commit',
  tone: 'technical',
  data: {
    message: 'feat: implement connection pooling with pgbouncer for Supabase',
    files: ['lib/supabase/client.ts', 'lib/supabase/pool.ts'],
    additions: 156,
    deletions: 34,
    filesChanged: 2,
  },
}

export const PROFESSIONAL_TONE: AgentEvent = {
  ...BASE,
  sourceType: 'pr',
  tone: 'professional',
  data: {
    title: 'feat: add role-based access control for enterprise teams',
    description:
      'Implements RBAC with granular permissions. Supports custom roles, team-level overrides, and audit logging.',
    files: ['lib/auth/rbac.ts', 'lib/auth/permissions.ts', 'app/api/admin/roles.ts'],
    additions: 678,
    deletions: 23,
    filesChanged: 12,
  },
}

export const X_PREMIUM_EVENT: AgentEvent = {
  ...BASE,
  sourceType: 'pr',
  xPremium: true,
  data: {
    title: 'feat: add real-time collaboration with live cursors',
    description:
      'WebSocket-based collaboration with live cursors, presence indicators, and conflict resolution using CRDTs.',
    files: ['lib/collab/ws.ts', 'lib/collab/cursor.ts', 'components/collab-overlay.tsx'],
    additions: 1200,
    deletions: 45,
    filesChanged: 15,
  },
}

// ─── Collections ──────────────────────────────────────────────────────

export const SHOULD_POST = [
  FEATURE_COMMIT,
  BUG_FIX_COMMIT,
  PERFORMANCE_COMMIT,
  FEATURE_PR,
  RELEASE,
  UI_IMPROVEMENT,
]

export const SHOULD_SKIP = [
  LINT_FIX,
  DEPENDENCY_BUMP,
  CI_CONFIG,
  TYPO_FIX,
  MERGE_COMMIT,
  REFACTOR_INTERNAL,
  LOCKFILE_UPDATE,
]

export const EDGE_CASES = [BIG_REFACTOR, VAGUE_COMMIT]

export const ALL_FIXTURES = [...SHOULD_POST, ...SHOULD_SKIP, ...EDGE_CASES]

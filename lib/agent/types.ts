export interface AgentEvent {
  sourceType: 'commit' | 'pr' | 'release' | 'tag'
  repoName: string
  repoId: string
  userId: string
  projectContext: string | null
  tone: 'casual' | 'professional' | 'technical'
  autoPublish: boolean
  xPremium: boolean
  data: EventData
  /** Pre-fetched recent posts for this repo — lets the ranker avoid
   * duplicating angles without needing a tool call. */
  recentPosts?: RecentPost[]
}

export interface EventData {
  message?: string
  title?: string
  description?: string
  files?: string[]
  url?: string
  additions?: number
  deletions?: number
  filesChanged?: number
  commitMessages?: string[]
  diffs?: FileDiff[]
}

export interface FileDiff {
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

/**
 * Ranker output. Every event produces a post — signal tells the UI whether
 * to surface it prominently ('high') or collapse under a "low priority"
 * disclosure ('low'). `error` signals the call failed; webhook should still
 * fall back to direct generation in that case.
 */
export interface AgentResult {
  signal: 'high' | 'low' | 'error'
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  angle: string | null
  content: string | null
  stepCount: number
}

export interface ProductMemory {
  key: string
  value: string
  category: string
  updated_at: string
}

export interface RecentDecision {
  decision: string
  reason: string
  source_type: string
  angle: string | null
  confidence: string
  created_at: string
}

export interface RecentPost {
  content: string
  source_type: string
  created_at: string
}

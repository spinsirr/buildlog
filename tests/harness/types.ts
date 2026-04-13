/** biome-ignore-all lint/suspicious/noExplicitAny: legacy harness pending ranker-migration rewrite */
import type {
  AgentEvent,
  AgentResult,
  ProductMemory,
  RecentDecision,
  RecentPost,
} from '@/lib/agent/types'

export type HarnessMode = 'mocked' | 'live'
// Ranker outputs signal + content; "error" means agent call failed.
// Legacy values ('post', 'skip', 'bundle_later') map to: post/bundle_later ~ high, skip ~ low.
export type HarnessExpectation = 'high' | 'low' | 'error'

export interface HarnessScenario {
  name: string
  expected: HarnessExpectation
  event: AgentEvent
  toolContext?: {
    memory?: ProductMemory[]
    decisions?: RecentDecision[]
    posts?: RecentPost[]
  }
}

export interface HarnessScenarioResult {
  name: string
  expected: HarnessExpectation
  actual: AgentResult['signal']
  passed: boolean
  checks: HarnessCheckResult[]
  reasoning: AgentResult['reasoning']
  explanation: string
  angle: string | null
  contentLength: number | null
  contentPreview: string | null
  stepCount: number
}

export interface HarnessCheckResult {
  name: string
  passed: boolean
  message?: string
}

export interface HarnessRunSummary {
  mode: HarnessMode
  total: number
  passed: number
  failed: number
  results: HarnessScenarioResult[]
}

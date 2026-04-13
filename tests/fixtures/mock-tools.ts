/** biome-ignore-all lint/suspicious/noExplicitAny: legacy harness pending ranker-migration rewrite */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock tool implementations for agent testing.
 *
 * These replace the real tools so tests run offline.
 * Each mock returns configurable repo context and recent posts.
 */

import { tool } from 'ai'
import { z } from 'zod'
import type { RecentPost } from '@/lib/agent/types'

export interface MockToolConfig {
  /** Repo context returned by get_repo_context */
  projectContext?: string | null
  /** Recent posts returned by get_recent_posts */
  posts?: RecentPost[]
  /** If true, generate_content returns null (simulates generation failure) */
  failGeneration?: boolean
  /** Custom content to return from generate_content (overrides LLM) */
  forcedContent?: string
  /** Track all tool calls for assertions */
  callLog?: ToolCall[]
}

export interface ToolCall {
  tool: string
  args: Record<string, unknown>
  timestamp: number
}

const DEFAULT_POSTS: RecentPost[] = [
  {
    content: 'Just shipped CSV export for inventory. Small feature, massive demand. #buildinpublic',
    source_type: 'commit',
    created_at: '2026-04-07T12:00:00Z',
  },
]

/**
 * Creates mock tool implementations that log calls and return configured responses.
 */
export function createMockTools(config: MockToolConfig = {}) {
  const callLog: ToolCall[] = config.callLog ?? []

  function log(tool: string, args: Record<string, unknown>) {
    callLog.push({ tool, args, timestamp: Date.now() })
  }

  return {
    tools: {
      get_repo_context: tool({
        description:
          'Get the current repository context for this event. Use this alongside the GitHub event details before deciding.',
        inputSchema: z.object({}),
        execute: async () => {
          log('get_repo_context', {})
          return {
            projectContext: config.projectContext ?? 'Widget App — React dashboard for e-commerce',
            repoName: 'acme/widget-app',
            tone: 'casual',
          }
        },
      }),

      get_recent_posts: tool({
        description:
          'Get recent posts for this repo to avoid duplicate angles and maintain narrative variety.',
        inputSchema: z.object({
          limit: z.number().optional().describe('Number of recent posts (default 5)'),
        }),
        execute: async ({ limit = 5 }) => {
          log('get_recent_posts', { limit })
          const posts = config.posts ?? DEFAULT_POSTS
          return { posts: posts.slice(0, limit), count: posts.length }
        },
      }),

      generate_content: tool({
        description:
          'Generate post content using Gemini with the specified angle and highlights. Call this when you decide to post. Returns the generated text.',
        inputSchema: z.object({
          angle: z.string().describe('The specific angle or hook for the post'),
          highlights: z.string().describe('Key points to emphasize'),
        }),
        execute: async ({ angle, highlights }) => {
          log('generate_content', { angle, highlights })

          if (config.failGeneration) {
            return { content: null, error: 'Generated content was empty or too short' }
          }

          if (config.forcedContent) {
            return {
              content: config.forcedContent,
              lengthBeforeWatermark: config.forcedContent.length,
            }
          }

          const content = `Shipped: ${angle}. ${highlights.split('.')[0]}. #buildinpublic`
          return { content, lengthBeforeWatermark: content.length }
        },
      }),
    } as any,
    callLog,
  }
}

/**
 * Creates a configurable mock that simulates different tool behaviors
 * for specific test scenarios.
 */
export function createMockToolsForScenario(
  scenario: 'empty_context' | 'recent_similar_post' | 'no_history',
  callLog?: ToolCall[]
) {
  switch (scenario) {
    case 'empty_context':
      return createMockTools({ projectContext: null, posts: [], callLog })

    case 'recent_similar_post':
      return createMockTools({
        posts: [
          {
            content: 'CSV export is live! #buildinpublic',
            source_type: 'commit',
            created_at: '2026-04-09T10:00:00Z',
          },
          {
            content: 'Added bulk export feature for inventory. #shipping',
            source_type: 'commit',
            created_at: '2026-04-08T15:00:00Z',
          },
        ],
        callLog,
      })

    case 'no_history':
      return createMockTools({
        projectContext: null,
        posts: [],
        callLog,
      })

    default:
      return createMockTools({ callLog })
  }
}

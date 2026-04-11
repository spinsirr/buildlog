/**
 * Mock LLM model factory for agent testing.
 *
 * Creates a configurable MockLanguageModelV3 that simulates the agent's
 * multi-step reasoning loop: tool calls → gather context → decide → generate.
 */

import type { LanguageModelV3CallOptions } from '@ai-sdk/provider'
import { MockLanguageModelV3 } from 'ai/test'

export type DecisionType = 'post' | 'skip' | 'bundle_later'

export interface MockModelConfig {
  /** What the agent should decide */
  decision: DecisionType
  /** Confidence level */
  confidence?: 'high' | 'medium' | 'low'
  /** Reasoning text */
  reasoning?: string
  /** Angle for post decisions */
  angle?: string | null
  /** Content for post decisions (set null to test missing content) */
  content?: string | null
  /** Which tools the model should call (in order). Default: all required tools */
  toolsToCall?: string[]
  /** If true, the model returns invalid JSON */
  returnGarbage?: boolean
}

/**
 * Creates a mock model that simulates the agent's reasoning loop.
 *
 * The mock tracks calls and returns tool_use for requested tools, then
 * returns the final structured output on the last call.
 */
export function createMockModel(config: MockModelConfig) {
  const {
    decision,
    confidence = 'high',
    reasoning = `Mock reasoning: analyzed the event and decided to ${decision}.`,
    angle = decision === 'post' ? 'user-facing feature shipped' : null,
    content = decision === 'post' ? 'Shipped a great new feature! #buildinpublic' : null,
    toolsToCall = ['get_repo_context', 'get_recent_posts', 'generate_content'],
    returnGarbage = false,
  } = config

  let callIndex = 0
  const calls: LanguageModelV3CallOptions[] = []

  const model = new MockLanguageModelV3({
    provider: 'test',
    modelId: 'mock-agent-model',
    doGenerate: async (options: LanguageModelV3CallOptions) => {
      calls.push(options)
      const currentCall = callIndex++

      // Simulate tool calls for the first N calls
      if (currentCall < toolsToCall.length) {
        const toolName = toolsToCall[currentCall]
        // generate_content requires angle + highlights params
        const input =
          toolName === 'generate_content'
            ? JSON.stringify({
                angle: angle ?? 'shipped feature',
                highlights: 'Key improvement for users.',
              })
            : '{}'
        return {
          finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
          usage: {
            inputTokens: { total: 100, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 50, text: 50, reasoning: 0 },
            totalTokens: 150,
          },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `mock-call-${currentCall}`,
              toolName,
              input,
            },
          ],
          warnings: [],
          response: { id: 'mock-response', timestamp: new Date(), modelId: 'mock-agent-model' },
        }
      }

      // Final call: return structured output
      if (returnGarbage) {
        return {
          finishReason: { unified: 'stop' as const, raw: 'stop' },
          usage: {
            inputTokens: { total: 200, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 30, text: 30, reasoning: 0 },
            totalTokens: 230,
          },
          content: [{ type: 'text' as const, text: 'NOT JSON {{{' }],
          warnings: [],
          response: { id: 'mock-response', timestamp: new Date(), modelId: 'mock-agent-model' },
        }
      }

      const output = {
        decision,
        reasoning,
        confidence,
        angle,
        content,
      }

      return {
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 200, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 80, text: 80, reasoning: 0 },
          totalTokens: 280,
        },
        content: [{ type: 'text' as const, text: JSON.stringify(output) }],
        warnings: [],
        response: { id: 'mock-response', timestamp: new Date(), modelId: 'mock-agent-model' },
      }
    },
  })

  return { model: model as any, getCalls: () => calls }
}

/**
 * Preset mock models for common test scenarios.
 */
export const mockModels = {
  /** Agent decides to post with good content */
  confidentPost: () =>
    createMockModel({
      decision: 'post',
      confidence: 'high',
      reasoning:
        'This is a user-visible feature that deserves a post. CSV export was highly requested.',
      angle: 'highly-requested feature finally shipped',
      content: 'CSV export is live. Your inventory data, one click away. #buildinpublic',
    }),

  /** Agent decides to skip */
  confidentSkip: () =>
    createMockModel({
      decision: 'skip',
      confidence: 'high',
      reasoning: 'This is a lint/formatting change with no user-facing impact. Not worth posting.',
    }),

  /** Agent posts but content is empty */
  postWithNoContent: () =>
    createMockModel({
      decision: 'post',
      confidence: 'medium',
      reasoning: 'Interesting change, worth sharing.',
      angle: 'internal improvement',
      content: null,
    }),

  /** Agent returns invalid JSON */
  garbageOutput: () =>
    createMockModel({
      decision: 'post',
      returnGarbage: true,
    }),

  /** Agent skips context gathering — goes straight to decision */
  skipsContextTools: () =>
    createMockModel({
      decision: 'skip',
      reasoning: 'Merge commit, nothing to post.',
      toolsToCall: [],
    }),

  /** Agent only calls some context tools but still generates content */
  partialContext: () =>
    createMockModel({
      decision: 'post',
      reasoning: 'Feature commit with significant changes.',
      angle: 'new capability added',
      content: 'Added a powerful new feature to the dashboard. #buildinpublic',
      toolsToCall: ['get_repo_context', 'generate_content'],
    }),

  /** Low confidence decision */
  lowConfidencePost: () =>
    createMockModel({
      decision: 'post',
      confidence: 'low',
      reasoning: 'Possibly worth sharing but not sure. The change is moderate.',
      angle: 'small improvement',
      content: 'Made some improvements to the settings page. #buildinpublic',
    }),
}

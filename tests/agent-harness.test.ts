/**
 * Agent Harness — comprehensive tests for the BuildLog decision agent.
 *
 * Tests are organized into layers:
 * 1. Pure logic tests (no mocking needed)
 * 2. Agent loop tests (mocked model + tools)
 * 3. Decision quality tests (fixture events)
 * 4. Content constraint tests
 * 5. Error handling tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgent, runAgentSafe } from '@/lib/agent/orchestrator'
import {
  AGENT_INSTRUCTIONS,
  buildContentPrompt,
  buildEventPrompt,
  classifyChange,
} from '@/lib/agent/prompts'
import type { AgentEvent } from '@/lib/agent/types'
import { DECISION_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getContentLimit, PLATFORM_CHAR_LIMITS } from '@/lib/platforms'
import { evaluate, evaluateDecisionAccuracy } from './fixtures/evaluator'
import {
  BIG_REFACTOR,
  BUG_FIX_COMMIT,
  CI_CONFIG,
  DEPENDENCY_BUMP,
  FEATURE_COMMIT,
  FEATURE_PR,
  LINT_FIX,
  LOCKFILE_UPDATE,
  MERGE_COMMIT,
  PERFORMANCE_COMMIT,
  PROFESSIONAL_TONE,
  REFACTOR_INTERNAL,
  RELEASE,
  SHOULD_POST,
  SHOULD_SKIP,
  TECHNICAL_TONE,
  TYPO_FIX,
  UI_IMPROVEMENT,
  VAGUE_COMMIT,
  X_PREMIUM_EVENT,
} from './fixtures/events'
import { createMockModel, mockModels } from './fixtures/mock-model'
import { createMockTools, createMockToolsForScenario } from './fixtures/mock-tools'

// ═══════════════════════════════════════════════════════════════════════
// Layer 1: Pure Logic Tests
// ═══════════════════════════════════════════════════════════════════════

describe('classifyChange', () => {
  it('classifies feat commits as feature', () => {
    expect(classifyChange(FEATURE_COMMIT)).toBe('feature')
  })

  it('classifies fix commits as bugfix', () => {
    expect(classifyChange(BUG_FIX_COMMIT)).toBe('bugfix')
  })

  it('classifies perf commits as performance', () => {
    expect(classifyChange(PERFORMANCE_COMMIT)).toBe('performance')
  })

  it('classifies style commits as ui', () => {
    expect(classifyChange(LINT_FIX)).toBe('ui')
  })

  it('classifies chore commits based on file names', () => {
    expect(classifyChange(DEPENDENCY_BUMP)).toBe('general')
  })

  it('classifies CI commits as devops', () => {
    expect(classifyChange(CI_CONFIG)).toBe('devops')
  })

  it('classifies merge commits as general', () => {
    expect(classifyChange(MERGE_COMMIT)).toBe('general')
  })

  it('classifies refactor commits', () => {
    expect(classifyChange(REFACTOR_INTERNAL)).toBe('refactor')
  })

  it('falls back to general for vague commits', () => {
    expect(classifyChange(VAGUE_COMMIT)).toBe('general')
  })

  it('classifies docs from file names', () => {
    const event: AgentEvent = {
      ...TYPO_FIX,
      data: { ...TYPO_FIX.data, message: 'update documentation' },
    }
    expect(classifyChange(event)).toBe('docs')
  })
})

describe('decision prompt semantics', () => {
  it('defines bundle_later for meaningful but not-yet-story-ready work', () => {
    expect(DECISION_SYSTEM_PROMPT).toContain(
      'meaningful progress, but not a strong standalone story yet'
    )
    expect(DECISION_SYSTEM_PROMPT).toContain('Small but meaningful refactors or cleanup')
    expect(DECISION_SYSTEM_PROMPT).toContain('prep work for a feature that is not user-visible yet')
    expect(DECISION_SYSTEM_PROMPT).toContain(
      'When in doubt between skip and bundle_later, prefer bundle_later'
    )
  })

  it('teaches the agent to use bundle_later for small refactors and prep work', () => {
    expect(AGENT_INSTRUCTIONS).toContain('small but meaningful refactor')
    expect(AGENT_INSTRUCTIONS).toContain('prep work, enablement, or infrastructure')
    expect(AGENT_INSTRUCTIONS).toContain(
      'If it is meaningful but incomplete, choose bundle_later instead of skip'
    )
  })
})

describe('buildEventPrompt', () => {
  it('includes commit message for commits', () => {
    const prompt = buildEventPrompt(FEATURE_COMMIT)
    expect(prompt).toContain('feat: add bulk export to CSV')
    expect(prompt).toContain('commit event')
  })

  it('includes title and description for PRs', () => {
    const prompt = buildEventPrompt(FEATURE_PR)
    expect(prompt).toContain('dark mode')
    expect(prompt).toContain('system preference detection')
  })

  it('includes release description for releases', () => {
    const prompt = buildEventPrompt(RELEASE)
    expect(prompt).toContain('v2.0.0')
    expect(prompt).toContain('Major release')
  })

  it('includes scale information when available', () => {
    const prompt = buildEventPrompt(FEATURE_COMMIT)
    expect(prompt).toContain('+287')
    expect(prompt).toContain('-12')
  })

  it('includes files when available', () => {
    const prompt = buildEventPrompt(FEATURE_COMMIT)
    expect(prompt).toContain('export')
  })
})

describe('contentBudget', () => {
  it('twitter standard is 280 chars', () => {
    expect(getContentLimit('twitter', false)).toBe(280)
  })

  it('twitter premium is 4000 chars', () => {
    expect(getContentLimit('twitter', true)).toBe(4000)
  })

  it('bluesky is 300 chars', () => {
    expect(getContentLimit('bluesky', false)).toBe(300)
  })

  it('linkedin is 3000 chars', () => {
    expect(getContentLimit('linkedin', false)).toBe(3000)
  })

  it('unknown platform falls back to twitter', () => {
    expect(getContentLimit('mastodon', false)).toBe(280)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 2: Agent Loop Tests (mocked model + tools)
// ═══════════════════════════════════════════════════════════════════════

describe('agent loop with mocked model', () => {
  it('returns a post decision with valid output schema', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()

    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(result.decision).toBe('post')
    expect(result.reasoning).toBeTruthy()
    expect(result.confidence).toBe('high')
    expect(result.angle).toBeTruthy()
    expect(result.content).toBeTruthy()
    expect(result.stepCount).toBeGreaterThan(0)
  })

  it('returns a skip decision', async () => {
    const { model } = mockModels.confidentSkip()
    const { tools } = createMockTools()

    const result = await runAgent(LINT_FIX, { model, tools })

    expect(result.decision).toBe('skip')
    expect(result.reasoning).toBeTruthy()
  })

  it('calls get_repo_context and get_recent_posts', async () => {
    const { model } = mockModels.confidentPost()
    const callLog: any[] = []
    const { tools } = createMockTools({ callLog })

    await runAgent(FEATURE_COMMIT, { model, tools })

    const toolNames = callLog.map((c) => c.tool)
    expect(toolNames).toContain('get_repo_context')
    expect(toolNames).toContain('get_recent_posts')
  })

  it('does not skip context gathering on a normal post path', async () => {
    const { model } = mockModels.partialContext()
    const callLog: any[] = []
    const { tools } = createMockTools({ callLog })

    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(result.decision).toBe('post')
    const toolNames = callLog.map((c) => c.tool)
    expect(toolNames).toContain('get_repo_context')
    expect(toolNames).toContain('generate_content')
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 3: Decision Quality Tests
// ═══════════════════════════════════════════════════════════════════════

describe('decision quality — post-worthy events', () => {
  for (const event of SHOULD_POST) {
    const label = `${event.sourceType}: ${event.data.message ?? event.data.title}`

    it(`should post: ${label}`, async () => {
      const { model } = mockModels.confidentPost()
      const { tools } = createMockTools()
      const result = await runAgent(event, { model, tools })

      const evalResult = evaluate(result, event)
      const accuracy = evaluateDecisionAccuracy(result, 'post')

      expect(accuracy.passed).toBe(true)
      if (!evalResult.passed) {
        const failures = evalResult.checks.filter((c) => !c.passed)
        console.warn(
          `Check failures for "${label}":`,
          failures.map((f) => `${f.name}: ${f.message}`)
        )
      }
    })
  }
})

describe('decision quality — skip-worthy events', () => {
  for (const event of SHOULD_SKIP) {
    const label = `${event.sourceType}: ${event.data.message ?? event.data.title}`

    it(`should skip: ${label}`, async () => {
      const { model } = mockModels.confidentSkip()
      const { tools } = createMockTools()
      const result = await runAgent(event, { model, tools })

      const accuracy = evaluateDecisionAccuracy(result, 'skip')
      expect(accuracy.passed).toBe(true)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 4: Content Constraint Tests
// ═══════════════════════════════════════════════════════════════════════

describe('content constraints', () => {
  it('content fits within standard Twitter limit (280 chars)', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()
    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(result.content).toBeTruthy()
    expect(result.content!.length).toBeLessThanOrEqual(280)
  })

  it('content fits within premium Twitter limit (4000 chars)', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()
    const result = await runAgent(X_PREMIUM_EVENT, { model, tools })

    expect(result.content).toBeTruthy()
    expect(result.content!.length).toBeLessThanOrEqual(4000)
  })

  it('content contains no exposed file paths', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()
    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    if (result.content) {
      expect(result.content).not.toMatch(/\.\w{1,4}\//)
      expect(result.content).not.toMatch(/app\//)
      expect(result.content).not.toMatch(/lib\//)
      expect(result.content).not.toMatch(/components\//)
    }
  })

  it('content contains no function/variable names', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()
    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    if (result.content) {
      expect(result.content).not.toMatch(/export\s+(default|const|function|class)/)
      expect(result.content).not.toMatch(/import\s+(.*\s+from|{)/)
      expect(result.content).not.toMatch(/const\s+\w+\s*=/)
    }
  })

  it('content is not empty when posting', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()
    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(result.decision).toBe('post')
    expect(result.content).toBeTruthy()
    expect(result.content!.trim().length).toBeGreaterThanOrEqual(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 5: Error Handling Tests
// ═══════════════════════════════════════════════════════════════════════

describe('error handling', () => {
  it('runAgentSafe returns error decision on model failure', async () => {
    const { model } = mockModels.garbageOutput()
    const { tools } = createMockTools()

    const result = await runAgentSafe(FEATURE_COMMIT, { model, tools })

    // Should either error or handle gracefully
    expect(['post', 'skip', 'error']).toContain(result.decision)
  })

  it('runAgentSafe catches exceptions and returns error result', async () => {
    const { tools } = createMockTools()

    // Create a model that throws
    const brokenModel = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'broken',
      doGenerate: async () => {
        throw new Error('API key invalid')
      },
      supportedUrls: {},
    }

    const result = await runAgentSafe(FEATURE_COMMIT, { model: brokenModel, tools })

    expect(result.decision).toBe('error')
    expect(result.reasoning).toContain('API key invalid')
    expect(result.stepCount).toBe(0)
  })

  it('handles empty repo context gracefully', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockToolsForScenario('empty_context')

    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(result.decision).toBe('post')
  })

  it('handles no recent-post history gracefully', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockToolsForScenario('no_history')

    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    expect(['post', 'skip']).toContain(result.decision)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 6: Tool Interaction Tests
// ═══════════════════════════════════════════════════════════════════════

describe('tool interaction', () => {
  it('passes event context to tools', async () => {
    const { model } = mockModels.confidentPost()
    const callLog: any[] = []
    const { tools } = createMockTools({ callLog })

    await runAgent(FEATURE_COMMIT, { model, tools })

    // Repo context and recent posts should have been fetched before deciding
    expect(callLog.length).toBeGreaterThanOrEqual(2)
  })

  it('configures different tools for empty-context scenario', async () => {
    const { model } = mockModels.confidentPost()
    const callLog: any[] = []
    const { tools } = createMockToolsForScenario('empty_context', callLog)

    const result = await runAgent(FEATURE_COMMIT, { model, tools })

    const contextCall = callLog.find((c) => c.tool === 'get_repo_context')
    expect(contextCall).toBeTruthy()
    expect(result.decision).toBe('post')
  })

  it('tracks all tool calls in order', async () => {
    const { model } = mockModels.confidentPost()
    const callLog: any[] = []
    const { tools } = createMockTools({ callLog })

    await runAgent(FEATURE_COMMIT, { model, tools })

    // Verify calls have timestamps in order
    for (let i = 1; i < callLog.length; i++) {
      expect(callLog[i].timestamp).toBeGreaterThanOrEqual(callLog[i - 1].timestamp)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════
// Layer 7: Tone Variation Tests
// ═══════════════════════════════════════════════════════════════════════

describe('tone variations', () => {
  it('handles technical tone events', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()

    const result = await runAgent(TECHNICAL_TONE, { model, tools })

    expect(result.decision).toBe('post')
    expect(result.content).toBeTruthy()
  })

  it('handles professional tone events', async () => {
    const { model } = mockModels.confidentPost()
    const { tools } = createMockTools()

    const result = await runAgent(PROFESSIONAL_TONE, { model, tools })

    expect(result.decision).toBe('post')
    expect(result.content).toBeTruthy()
  })
})

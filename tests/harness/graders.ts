import type { AgentResult } from '@/lib/agent/types'
import type {
  HarnessCheckResult,
  HarnessExpectation,
  HarnessScenario,
  HarnessScenarioResult,
} from './types'

export function gradeScenario(
  scenario: HarnessScenario,
  result: AgentResult,
  checks: HarnessCheckResult[] = []
): HarnessScenarioResult {
  const actual = result.decision
  const expected = scenario.expected
  const decisionMatches = expected === actual
  const failedChecks = checks.filter((check) => !check.passed)
  const passed = decisionMatches && failedChecks.length === 0

  return {
    name: scenario.name,
    expected,
    actual,
    passed,
    checks,
    reasoning: result.reasoning,
    angle: result.angle,
    contentLength: result.content?.length ?? null,
    contentPreview: result.content ? result.content.slice(0, 140) : null,
    stepCount: result.stepCount,
    explanation: buildExplanation({ expected, actual, reasoning: result.reasoning, failedChecks }),
  }
}

export function makeCheck(name: string, passed: boolean, message?: string): HarnessCheckResult {
  return { name, passed, message }
}

export function expectedDecisionFromExpected(
  expected: HarnessExpectation
): 'post' | 'skip' | 'bundle_later' | 'error' {
  if (expected === 'error') return 'error'
  return expected
}

function buildExplanation({
  expected,
  actual,
  reasoning,
  failedChecks,
}: {
  expected: HarnessExpectation
  actual: AgentResult['decision']
  reasoning: string
  failedChecks: HarnessCheckResult[]
}): string {
  const parts: string[] = []

  if (expected !== actual) {
    parts.push(`Decision mismatch: expected ${expected}, got ${actual}.`)
  } else {
    parts.push(`Decision matched expected outcome (${actual}).`)
  }

  if (failedChecks.length > 0) {
    const failures = failedChecks.map((check) => check.message ?? check.name).join('; ')
    parts.push(`Failed checks: ${failures}.`)
  } else {
    parts.push('All harness checks passed.')
  }

  parts.push(`Agent reasoning: ${reasoning}`)

  return parts.join(' ')
}

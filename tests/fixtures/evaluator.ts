/** biome-ignore-all lint/suspicious/noExplicitAny: legacy harness pending ranker-migration rewrite */
// @ts-nocheck — pending ranker-migration rewrite
/**
 * Agent output evaluator — validates decision quality, content constraints,
 * and reasoning coherence from agent results.
 */

import type { AgentEvent, AgentResult } from '@/lib/agent/types'

export interface EvalResult {
  passed: boolean
  checks: CheckResult[]
}

export interface CheckResult {
  name: string
  passed: boolean
  message?: string
}

/**
 * Validate the agent result against all quality checks.
 */
export function evaluate(result: AgentResult, event: AgentEvent): EvalResult {
  const checks: CheckResult[] = []

  checks.push(checkValidDecision(result))
  checks.push(checkHasReasoning(result))
  checks.push(checkConfidenceLevel(result))

  if (result.decision === 'post') {
    checks.push(checkHasContent(result, event))
    checks.push(checkHasAngle(result))
    checks.push(checkContentLength(result, event))
    checks.push(checkNoExposedPaths(result))
    checks.push(checkNoExposedFunctionNames(result))
    checks.push(checkHasHashtags(result))
  }

  if (result.decision === 'skip' || result.decision === 'bundle_later') {
    checks.push(checkSkipHasNoContent(result))
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  }
}

/**
 * Validate that a post decision matches expected outcome.
 * Used for precision/recall testing.
 */
export function evaluateDecisionAccuracy(
  result: AgentResult,
  expected: 'post' | 'skip' | 'bundle_later' | 'error'
): CheckResult {
  const actual = result.decision
  return {
    name: 'decision_accuracy',
    passed: actual === expected,
    message: actual !== expected ? `Expected ${expected}, got ${actual}` : undefined,
  }
}

// ─── Individual checks ────────────────────────────────────────────────

function checkValidDecision(result: AgentResult): CheckResult {
  const valid = ['post', 'skip', 'bundle_later', 'error'].includes(result.decision)
  return {
    name: 'valid_decision',
    passed: valid,
    message: !valid ? `Invalid decision: ${result.decision}` : undefined,
  }
}

function checkHasReasoning(result: AgentResult): CheckResult {
  const has = result.reasoning && result.reasoning.trim().length >= 20
  return {
    name: 'has_reasoning',
    passed: !!has,
    message: !has ? 'Reasoning is missing or too short (< 20 chars)' : undefined,
  }
}

function checkConfidenceLevel(result: AgentResult): CheckResult {
  const valid = ['high', 'medium', 'low'].includes(result.confidence)
  return {
    name: 'valid_confidence',
    passed: valid,
    message: !valid ? `Invalid confidence: ${result.confidence}` : undefined,
  }
}

function checkHasContent(result: AgentResult, event: AgentEvent): CheckResult {
  const has = result.content && result.content.trim().length >= 10
  return {
    name: 'has_content',
    passed: !!has,
    message: !has ? 'Post decision but content is missing or too short' : undefined,
  }
}

function checkHasAngle(result: AgentResult): CheckResult {
  const has = result.angle && result.angle.trim().length >= 5
  return {
    name: 'has_angle',
    passed: !!has,
    message: !has ? 'Post decision but angle is missing or too short' : undefined,
  }
}

function checkContentLength(result: AgentResult, event: AgentEvent): CheckResult {
  if (!result.content)
    return { name: 'content_length', passed: false, message: 'No content to check' }

  const limits: Record<string, number> = {
    twitter: event.xPremium ? 4000 : 280,
    bluesky: 300,
    linkedin: 3000,
  }
  const limit = limits.twitter // Primary platform for now
  const within = result.content.length <= limit

  return {
    name: 'content_length',
    passed: within,
    message: !within
      ? `Content is ${result.content.length} chars, exceeds ${limit} limit`
      : undefined,
  }
}

function checkNoExposedPaths(result: AgentResult): CheckResult {
  if (!result.content) return { name: 'no_exposed_paths', passed: true }

  const pathPatterns = [
    /\.\w{1,4}\//, // file extensions like .tsx/, .ts/
    /app\//, // Next.js app dir
    /lib\//, // lib directory
    /components\//, // components dir
    /src\//, // src dir
    /node_modules/, // node_modules
    /\.json/, // .json files
    /\.config\./, // config files
  ]

  const exposed = pathPatterns.some((p) => p.test(result.content!))
  return {
    name: 'no_exposed_paths',
    passed: !exposed,
    message: exposed ? 'Content exposes internal file paths' : undefined,
  }
}

function checkNoExposedFunctionNames(result: AgentResult): CheckResult {
  if (!result.content) return { name: 'no_exposed_functions', passed: true }

  const fnPatterns = [
    /\w+\(\)/, // function()
    /function\s+\w+/, // function name
    /const\s+\w+\s*=/, // const name =
    /async\s+/, // async keyword
    /export\s+(default|const|function|class|interface|type)/, // code-level export
    /import\s+(.*\s+from|{)/, // code-level import
  ]

  const exposed = fnPatterns.some((p) => p.test(result.content!))
  return {
    name: 'no_exposed_functions',
    passed: !exposed,
    message: exposed ? 'Content exposes code-level function/variable names' : undefined,
  }
}

function checkHasHashtags(result: AgentResult): CheckResult {
  if (!result.content) return { name: 'has_hashtags', passed: false, message: 'No content' }

  const hasHash = /#\w+/.test(result.content)
  return {
    name: 'has_hashtags',
    passed: hasHash,
    message: !hasHash ? 'Content lacks hashtags' : undefined,
  }
}

function checkSkipHasNoContent(result: AgentResult): CheckResult {
  const clean = !result.content || result.content.trim().length === 0
  return {
    name: 'skip_no_content',
    passed: clean,
    message: !clean ? 'Skip decision should not have content' : undefined,
  }
}

/**
 * Generate a summary report from evaluation results.
 */
export function generateReport(
  results: Array<{
    event: string
    eval: EvalResult
    expected: 'post' | 'skip' | 'bundle_later' | 'error'
    result: AgentResult
  }>
): string {
  const total = results.length
  const passed = results.filter((r) => r.eval.passed).length

  // Decision accuracy
  let truePositives = 0,
    falsePositives = 0,
    trueNegatives = 0,
    falseNegatives = 0
  for (const r of results) {
    const actual = r.result.decision
    if (actual === 'post' && r.expected === 'post') truePositives++
    else if (actual === 'post' && r.expected === 'skip') falsePositives++
    else if (actual === 'skip' && r.expected === 'skip') trueNegatives++
    else if (actual === 'skip' && r.expected === 'post') falseNegatives++
  }

  const precision = truePositives / (truePositives + falsePositives) || 0
  const recall = truePositives / (truePositives + falseNegatives) || 0
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  const lines: string[] = [
    `Agent Harness Results: ${passed}/${total} events passed all checks`,
    ``,
    `Decision Metrics:`,
    `  True Positives:  ${truePositives}  (correctly decided to post)`,
    `  False Positives: ${falsePositives}  (should have skipped, but posted)`,
    `  True Negatives:  ${trueNegatives}  (correctly skipped)`,
    `  False Negatives: ${falseNegatives}  (should have posted, but skipped)`,
    ``,
    `  Precision: ${(precision * 100).toFixed(1)}%`,
    `  Recall:    ${(recall * 100).toFixed(1)}%`,
    `  F1 Score:  ${(f1 * 100).toFixed(1)}%`,
    ``,
  ]

  // Per-event breakdown
  for (const r of results) {
    const status = r.eval.passed ? '✓' : '✗'
    const checks = r.eval.checks
      .filter((c) => !c.passed)
      .map((c) => `  - ${c.name}: ${c.message}`)
      .join('\n')

    lines.push(`${status} ${r.event} (expected: ${r.expected})`)
    if (checks) lines.push(checks)
  }

  return lines.join('\n')
}

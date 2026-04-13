/* eslint-disable @typescript-eslint/ban-ts-comment */
/** biome-ignore-all lint/suspicious/noExplicitAny: legacy harness pending ranker-migration rewrite */
// @ts-nocheck — pending ranker-migration rewrite
import type { HarnessRunSummary, HarnessScenarioResult } from './types'

export function renderMarkdownReport(summary: HarnessRunSummary): string {
  const lines: string[] = []
  const grouped = summarizeOutcomes(summary.results)

  lines.push(`# BuildLog Agent Harness Report`)
  lines.push('')
  lines.push(`- Mode: ${summary.mode}`)
  lines.push(`- Passed: ${summary.passed}/${summary.total}`)
  lines.push(`- Failed: ${summary.failed}`)
  lines.push(`- Posted: ${grouped.post}`)
  lines.push(`- Skipped: ${grouped.skip}`)
  lines.push(`- Bundle later: ${grouped.bundle_later}`)
  lines.push(`- Errors: ${grouped.error}`)
  const failedNames = summary.results
    .filter((result) => !result.passed)
    .map((result) => result.name)
  if (failedNames.length > 0) lines.push(`- Failures: ${failedNames.join(', ')}`)
  lines.push('')

  for (const result of summary.results) {
    const failedChecks = result.checks.filter((check) => !check.passed)
    lines.push(`## ${result.name}`)
    lines.push(`- Expected: ${result.expected}`)
    lines.push(`- Actual: ${result.actual}`)
    lines.push(`- Passed: ${result.passed ? 'yes' : 'no'}`)
    lines.push(`- Explanation: ${result.explanation}`)
    if (result.angle) lines.push(`- Angle: ${result.angle}`)
    if (result.contentPreview) lines.push(`- Content preview: ${result.contentPreview}`)
    if (result.contentLength !== null) lines.push(`- Content length: ${result.contentLength}`)
    lines.push(`- Steps: ${result.stepCount}`)
    if (failedChecks.length > 0) {
      lines.push('- Failed checks:')
      for (const check of failedChecks) {
        lines.push(`  - ❌ ${check.name}${check.message ? `: ${check.message}` : ''}`)
      }
    }
    if (result.checks.length > 0) {
      lines.push('- All checks:')
      for (const check of result.checks) {
        lines.push(
          `  - ${check.passed ? '✅' : '❌'} ${check.name}${check.message ? `: ${check.message}` : ''}`
        )
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function summarizeOutcomes(results: HarnessScenarioResult[]) {
  return results.reduce(
    (counts, result) => {
      counts[result.actual] += 1
      return counts
    },
    { post: 0, skip: 0, bundle_later: 0, error: 0 }
  )
}

export function renderJsonReport(summary: HarnessRunSummary): string {
  return JSON.stringify(summary, null, 2)
}

/* eslint-disable @typescript-eslint/ban-ts-comment */
/** biome-ignore-all lint/suspicious/noExplicitAny: legacy harness pending ranker-migration rewrite */
// @ts-nocheck — pending ranker-migration rewrite
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runAgentSafe } from '@/lib/agent/orchestrator'
import { evaluate, evaluateDecisionAccuracy } from '../fixtures/evaluator'
import { createMockModel } from '../fixtures/mock-model'
import { createMockTools } from '../fixtures/mock-tools'
import { expectedDecisionFromExpected, gradeScenario, makeCheck } from './graders'
import { renderJsonReport, renderMarkdownReport } from './report'
import type { HarnessRunSummary, HarnessScenario, HarnessScenarioResult } from './types'

const SCENARIO_DIR = new URL('./scenarios', import.meta.url)

async function loadScenarios(): Promise<HarnessScenario[]> {
  const dir = SCENARIO_DIR.pathname
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  const scenarios: HarnessScenario[] = []
  for (const file of files) {
    const raw = await readFile(join(dir, file), 'utf8')
    scenarios.push(JSON.parse(raw) as HarnessScenario)
  }
  return scenarios
}

async function runScenario(scenario: HarnessScenario, mode: 'mocked' | 'live') {
  const expected = expectedDecisionFromExpected(scenario.expected)
  const expectedForModel = expected === 'error' ? 'skip' : expected

  if (mode === 'live') {
    const result = await runAgentSafe(scenario.event)
    const evalResult = evaluate(result, scenario.event)
    return gradeScenario(scenario, result, [
      evaluateDecisionAccuracy(result, expected),
      ...evalResult.checks.map((check) => makeCheck(check.name, check.passed, check.message)),
    ])
  }

  const { model } = createMockModel({
    decision: expectedForModel as 'post' | 'skip' | 'bundle_later',
    confidence: 'high',
    reasoning:
      expectedForModel === 'bundle_later'
        ? 'This refactor matters, but the story is incomplete on its own. Better to bundle it with the related user-facing work.'
        : expected === 'error'
          ? 'The model returned invalid structured output, so the harness should surface an error instead of silently counting it as a skip.'
          : undefined,
    angle: expectedForModel === 'post' ? 'harness-generated angle' : null,
    content: expectedForModel === 'post' ? 'Harness generated a valid post. #buildinpublic' : null,
    returnGarbage: scenario.expected === 'error',
  } as any)
  const { tools } = createMockTools((scenario.toolContext ?? {}) as any)
  const result = await runAgentSafe(scenario.event, { model, tools })
  const evalResult = evaluate(result, scenario.event)
  return gradeScenario(scenario, result, [
    evaluateDecisionAccuracy(result, expected),
    ...evalResult.checks.map((check) => makeCheck(check.name, check.passed, check.message)),
  ])
}

export async function runHarness(mode: 'mocked' | 'live' = 'mocked'): Promise<HarnessRunSummary> {
  const scenarios = await loadScenarios()
  const results: HarnessScenarioResult[] = []
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario, mode))
  }
  const passed = results.filter((r) => r.passed).length
  const summary: HarnessRunSummary = {
    mode,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  }

  await writeFile(
    join(SCENARIO_DIR.pathname, '..', `report.${mode}.json`),
    renderJsonReport(summary),
    'utf8'
  )
  await writeFile(
    join(SCENARIO_DIR.pathname, '..', `report.${mode}.md`),
    renderMarkdownReport(summary),
    'utf8'
  )
  return summary
}

if ((import.meta as any).main) {
  const mode = process.argv.includes('--live') ? 'live' : 'mocked'
  const summary = await runHarness(mode)
  console.log(renderMarkdownReport(summary))
}

import { getProductContext, getRecentDecisions } from './context'
import { decide } from './decision'
import { generate } from './generate'
import type {
  DecisionInput,
  DecisionOutput,
  GenerateInput,
  ProcessInput,
  ProcessOutput,
} from './schemas'

// ---------------------------------------------------------------------------
// AI engine orchestrator — ties decision, context, and generation together.
// This is the main entry point for the AI pipeline.
// ---------------------------------------------------------------------------

/**
 * Full pipeline: retrieve context → decide → generate (if decision is "post").
 * Called from the /api/ai/process route.
 */
export async function processEvent(input: ProcessInput): Promise<ProcessOutput> {
  // 1. Retrieve product context and decision history
  const [productContext, recentDecisions] = await Promise.all([
    input.repoId ? getProductContext(input.userId, input.repoId) : null,
    input.repoId ? getRecentDecisions(input.userId, input.repoId) : [],
  ])

  // 2. Run decision engine
  const decisionInput: DecisionInput = {
    sourceType: input.sourceType,
    repoName: input.repoName,
    projectContext: input.projectContext,
    productContext: productContext
      ? {
          productSummary: productContext.productSummary,
          targetAudience: productContext.targetAudience,
          currentNarrative: productContext.currentNarrative,
          topicsToEmphasize: productContext.topicsToEmphasize,
          topicsToAvoid: productContext.topicsToAvoid,
          lastPostAngle: productContext.lastPostAngle,
        }
      : null,
    recentDecisions: recentDecisions ?? undefined,
    data: input.data,
  }

  let decision: DecisionOutput
  try {
    decision = await decide(decisionInput)
  } catch {
    // Fail-open: if decision engine errors, default to "post"
    decision = {
      decision: 'post',
      reason: 'Decision engine error — defaulting to post',
      confidence: 'low',
      angle: null,
    }
  }

  // 3. If decision is not "post", skip generation
  if (decision.decision !== 'post') {
    return {
      decision,
      content: null,
      skipped: true,
    }
  }

  // 4. Generate content
  const generateInput: GenerateInput = {
    sourceType: input.sourceType,
    repoName: input.repoName,
    tone: input.tone,
    projectContext: input.projectContext,
    productContext: productContext
      ? {
          productSummary: productContext.productSummary,
          targetAudience: productContext.targetAudience,
          currentNarrative: productContext.currentNarrative,
          topicsToEmphasize: productContext.topicsToEmphasize,
          topicsToAvoid: productContext.topicsToAvoid,
        }
      : null,
    angle: decision.angle,
    variant: 'default',
    data: input.data,
  }

  const content = await generate(generateInput)

  return {
    decision,
    content,
    skipped: false,
  }
}

/**
 * Decision only — for standalone decision evaluation.
 */
export { decide } from './decision'

/**
 * Generation only — for standalone content generation.
 */
export { generate } from './generate'

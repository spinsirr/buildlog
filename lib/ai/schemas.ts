import { z } from 'zod'

// ---------------------------------------------------------------------------
// Decision layer schemas
// ---------------------------------------------------------------------------

export const decisionInputSchema = z.object({
  sourceType: z.enum(['commit', 'pr', 'release', 'tag']),
  repoName: z.string(),
  projectContext: z.string().nullable().optional(),
  productContext: z
    .object({
      productSummary: z.string().nullable().optional(),
      targetAudience: z.string().nullable().optional(),
      currentNarrative: z.string().nullable().optional(),
      topicsToEmphasize: z.array(z.string()).optional(),
      topicsToAvoid: z.array(z.string()).optional(),
      lastPostAngle: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  recentDecisions: z
    .array(
      z.object({
        decision: z.string(),
        reason: z.string(),
        sourceType: z.string(),
        angle: z.string().nullable(),
        createdAt: z.string(),
      })
    )
    .optional(),
  data: z.object({
    message: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    files: z.array(z.string()).optional(),
    url: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    filesChanged: z.number().optional(),
    commitMessages: z.array(z.string()).optional(),
    diffs: z
      .array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number(),
          deletions: z.number(),
          patch: z.string().optional(),
        })
      )
      .optional(),
  }),
})

export type DecisionInput = z.infer<typeof decisionInputSchema>

export const decisionOutputSchema = z.object({
  decision: z.enum(['post', 'skip', 'bundle_later']),
  reason: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  angle: z.string().nullable(),
  suggestedPlatforms: z.array(z.string()).optional(),
})

export type DecisionOutput = z.infer<typeof decisionOutputSchema>

// ---------------------------------------------------------------------------
// Generation schemas
// ---------------------------------------------------------------------------

export const generateInputSchema = z.object({
  sourceType: z.enum(['commit', 'pr', 'release', 'tag', 'intro']),
  repoName: z.string(),
  tone: z.enum(['casual', 'professional', 'technical']).default('casual'),
  projectContext: z.string().nullable().optional(),
  productContext: z
    .object({
      productSummary: z.string().nullable().optional(),
      targetAudience: z.string().nullable().optional(),
      currentNarrative: z.string().nullable().optional(),
      topicsToEmphasize: z.array(z.string()).optional(),
      topicsToAvoid: z.array(z.string()).optional(),
    })
    .nullable()
    .optional(),
  angle: z.string().nullable().optional(),
  contentBudget: z.number().optional(),
  variant: z.enum(['default', 'xhs']).default('default'),
  data: z.object({
    message: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    files: z.array(z.string()).optional(),
    url: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    filesChanged: z.number().optional(),
    commitMessages: z.array(z.string()).optional(),
    diffs: z
      .array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number(),
          deletions: z.number(),
          patch: z.string().optional(),
        })
      )
      .optional(),
  }),
})

export type GenerateInput = z.infer<typeof generateInputSchema>

// ---------------------------------------------------------------------------
// Full pipeline schemas
// ---------------------------------------------------------------------------

export const processInputSchema = z.object({
  sourceType: z.enum(['commit', 'pr', 'release', 'tag']),
  repoName: z.string(),
  repoId: z.string().optional(),
  userId: z.string(),
  tone: z.enum(['casual', 'professional', 'technical']).default('casual'),
  projectContext: z.string().nullable().optional(),
  data: z.object({
    message: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    files: z.array(z.string()).optional(),
    url: z.string().optional(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    filesChanged: z.number().optional(),
    commitMessages: z.array(z.string()).optional(),
    diffs: z
      .array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number(),
          deletions: z.number(),
          patch: z.string().optional(),
        })
      )
      .optional(),
  }),
})

export type ProcessInput = z.infer<typeof processInputSchema>

export const processOutputSchema = z.object({
  decision: decisionOutputSchema,
  content: z.string().nullable(),
  skipped: z.boolean(),
})

export type ProcessOutput = z.infer<typeof processOutputSchema>

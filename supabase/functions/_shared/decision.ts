import { getLog } from "./logger.ts"

const log = getLog("decision")

// ---------------------------------------------------------------------------
// Decision layer — determines whether a GitHub event is worth posting about
// ---------------------------------------------------------------------------

export interface DecisionInput {
  sourceType: "commit" | "pr" | "release" | "tag"
  repoName: string
  projectContext?: string | null
  data: {
    message?: string
    title?: string
    description?: string
    files?: string[]
    url?: string
    additions?: number
    deletions?: number
    filesChanged?: number
    commitMessages?: string[]
    diffs?: Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      patch?: string
    }>
  }
}

export interface PostDecision {
  decision: "post" | "skip" | "bundle_later"
  reason: string
  confidence: "high" | "medium" | "low"
  angle: string | null
}

const DECISION_SYSTEM_PROMPT =
  `You are a developer content strategist. Your job is to evaluate GitHub events and decide whether they are worth sharing as a public "build in public" post.

You will receive context about a code change (commit, PR merge, release, or tag). Decide:

1. **post** — This is interesting, meaningful, or share-worthy. It shows real progress, a notable fix, a new feature, or a milestone.
2. **skip** — This is routine, trivial, or not interesting to an audience. Examples: formatting fixes, dependency bumps, typo corrections, merge commits, CI config tweaks, linter fixes.
3. **bundle_later** — This is meaningful progress, but not a strong standalone story yet. Save it for a later post that bundles related work into a clearer narrative.

Guidelines:
- Features, meaningful bug fixes, releases, and milestones → post
- Pure formatting, linting, trivial config, merge commits → skip
- Small incremental steps toward a larger feature → bundle_later
- Small but meaningful refactors or cleanup that improve the product or developer experience, but need adjacent changes to tell the full story → bundle_later
- Early infrastructure, enablement, or prep work for a feature that is not user-visible yet → bundle_later
- Use skip only when the work is routine or uninteresting even after bundling
- When in doubt between post and bundle_later, prefer bundle_later
- When in doubt between skip and bundle_later, prefer bundle_later

You MUST respond with valid JSON matching this exact schema:
{
  "decision": "post" | "skip" | "bundle_later",
  "reason": "Brief explanation of why this decision was made",
  "confidence": "high" | "medium" | "low",
  "angle": "If decision is 'post', suggest a compelling angle/hook for the post. Otherwise null."
}

Respond with ONLY the JSON object. No markdown, no code fences, no explanation outside the JSON.`

function buildDecisionPrompt(input: DecisionInput): string {
  const parts: string[] = []

  parts.push(`Event type: ${input.sourceType}`)
  parts.push(`Repository: ${input.repoName}`)

  if (input.data.message) {
    parts.push(`Commit message: "${input.data.message}"`)
  }
  if (input.data.title) {
    parts.push(`Title: "${input.data.title}"`)
  }
  if (input.data.description) {
    parts.push(`Description: "${input.data.description.slice(0, 500)}"`)
  }

  if (input.data.additions !== undefined || input.data.deletions !== undefined) {
    parts.push(
      `Scale: +${input.data.additions ?? 0} -${input.data.deletions ?? 0} lines, ${
        input.data.filesChanged ?? "?"
      } files`,
    )
  }

  if (input.data.commitMessages && input.data.commitMessages.length > 0) {
    const msgs = input.data.commitMessages.slice(0, 10).join("\n- ")
    parts.push(`Commits:\n- ${msgs}`)
  }

  if (input.data.files && input.data.files.length > 0) {
    const fileList = input.data.files.slice(0, 15).join(", ")
    parts.push(`Files: ${fileList}`)
  }

  if (input.projectContext) {
    parts.push(`Project context: ${input.projectContext.slice(0, 800)}`)
  }

  return parts.join("\n")
}

function parseDecisionResponse(text: string): PostDecision {
  // Strip markdown code fences if the model wrapped them
  let cleaned = text.trim()
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "")
  }

  const parsed = JSON.parse(cleaned)

  // Validate required fields
  const validDecisions = ["post", "skip", "bundle_later"]
  const validConfidences = ["high", "medium", "low"]

  if (!validDecisions.includes(parsed.decision)) {
    throw new Error(`Invalid decision: ${parsed.decision}`)
  }
  if (!parsed.reason || typeof parsed.reason !== "string") {
    throw new Error("Missing or invalid reason")
  }
  if (!validConfidences.includes(parsed.confidence)) {
    throw new Error(`Invalid confidence: ${parsed.confidence}`)
  }

  return {
    decision: parsed.decision,
    reason: parsed.reason,
    confidence: parsed.confidence,
    angle: parsed.decision === "post" && parsed.angle ? String(parsed.angle) : null,
  }
}

export async function decidePostAction(input: DecisionInput): Promise<PostDecision> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY")
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY (or GOOGLE_API_KEY)")
  }

  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3-flash-preview"
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const prompt = buildDecisionPrompt(input)

  const body = JSON.stringify({
    system_instruction: {
      parts: [{ text: DECISION_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 300,
      responseMimeType: "application/json",
    },
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API error: ${res.status} ${errText}`)
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim()

    if (!text) throw new Error("Gemini decision response was empty")

    const decision = parseDecisionResponse(text)

    log.info("decision for {sourceType} in {repo}: {decision} ({confidence}) — {reason}", {
      sourceType: input.sourceType,
      repo: input.repoName,
      decision: decision.decision,
      confidence: decision.confidence,
      reason: decision.reason,
    })

    return decision
  } catch (err) {
    // On any failure, default to "post" so we don't silently drop events
    log.error("decision failed, defaulting to post: {error}", {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      decision: "post",
      reason: "Decision layer error — defaulting to post",
      confidence: "low",
      angle: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

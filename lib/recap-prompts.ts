export const recapToneInstructions: Record<string, string> = {
  casual: 'Use a friendly, conversational tone. Sound like a developer tweeting to friends.',
  professional:
    'Use a polished, professional tone. Sound like a founder giving a confident product update.',
  technical: 'Use a technical tone with specifics. Sound like a senior engineer sharing knowledge.',
}

export interface BundleDecision {
  id: string
  source_type: string
  source_data: Record<string, unknown>
  reason: string
  angle: string | null
  created_at: string
}

export interface RecapPost {
  id: string
  content: string
  source_type: string
  source_data: Record<string, unknown> | null
  created_at: string
}

export function buildRecapSystemPrompt(tone: string, charLimit: number): string {
  return `You are a weekly recap writer for a developer's "build in public" social media.

TONE:
${recapToneInstructions[tone] ?? recapToneInstructions.casual}

YOUR JOB: Read the developer's week of activity below and write a single recap post summarizing what they shipped. Weave bundled (deferred) events into a coherent narrative alongside already-published updates.

CRITICAL RULES:
- MUST be under ${charLimit} characters
- Highlight the overall theme or direction of the week
- Mention 2-4 key things shipped or worked on
- End with 1-2 relevant hashtags
- Sound like a real person, not a bot
- Do NOT expose file names, function names, or internal architecture
- Talk about what the USER can now do or what PROGRESS was made
- If there are bundled events, weave them into the narrative naturally
- This is a WEEKLY SUMMARY, not individual updates

Output ONLY the post text, nothing else.`
}

export function buildRecapUserPrompt(bundles: BundleDecision[], posts: RecapPost[]): string {
  const parts: string[] = []

  if (bundles.length > 0) {
    const bundleLines = bundles.map((b) => {
      const msg = (b.source_data?.message ?? b.source_data?.title ?? 'unknown change') as string
      return `- [${b.source_type}] ${msg} — reason deferred: "${b.reason}"${b.angle ? ` (angle: ${b.angle})` : ''}`
    })
    parts.push(
      `BUNDLED EVENTS (deferred from individual posts, not yet shared publicly):\n${bundleLines.join('\n')}`
    )
  }

  if (posts.length > 0) {
    const postLines = posts.map((p) => `- "${p.content}"`)
    parts.push(`ALREADY SHARED THIS WEEK:\n${postLines.join('\n')}`)
  }

  parts.push('Generate ONE weekly recap post that covers the full week.')
  return parts.join('\n\n')
}

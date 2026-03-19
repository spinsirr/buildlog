import { generateText } from 'ai'

interface GeneratePostInput {
  sourceType: 'commit' | 'pr' | 'release'
  repoName: string
  tone?: 'casual' | 'professional' | 'technical'
  data: {
    message?: string
    title?: string
    description?: string
    files?: string[]
    url?: string
  }
}

const toneInstructions: Record<string, string> = {
  casual: 'Use a friendly, conversational tone. Be relatable and approachable.',
  professional: 'Use a polished, professional tone. Be clear and authoritative.',
  technical: 'Use a technical tone with specifics. Include technical details and terminology.',
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const context = input.sourceType === 'commit'
    ? `Commit: "${input.data.message}" in ${input.repoName}`
    : input.sourceType === 'pr'
    ? `PR merged: "${input.data.title}" in ${input.repoName}\n${input.data.description ?? ''}`
    : `Release: "${input.data.title}" in ${input.repoName}\n${input.data.description ?? ''}`

  const tone = input.tone ?? 'casual'

  const { text } = await generateText({
    model: 'google/gemini-3.0-flash',
    system: `You are a build-in-public assistant. Generate engaging, authentic social media posts about developer progress.
Keep it concise (under 280 chars for Twitter), authentic, and developer-friendly.
No excessive emojis. Focus on what was built, learned, or shipped. End with relevant hashtags like #buildinpublic #coding.
${toneInstructions[tone]}`,
    prompt: `Generate a build-in-public post for this update:\n${context}`,
  })

  return text
}

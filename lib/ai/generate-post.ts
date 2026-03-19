import { generateText } from 'ai'

interface GeneratePostInput {
  sourceType: 'commit' | 'pr' | 'release'
  repoName: string
  data: {
    message?: string
    title?: string
    description?: string
    files?: string[]
    url?: string
  }
}

export async function generatePost(input: GeneratePostInput): Promise<string> {
  const context = input.sourceType === 'commit'
    ? `Commit: "${input.data.message}" in ${input.repoName}`
    : input.sourceType === 'pr'
    ? `PR merged: "${input.data.title}" in ${input.repoName}\n${input.data.description ?? ''}`
    : `Release: "${input.data.title}" in ${input.repoName}\n${input.data.description ?? ''}`

  const { text } = await generateText({
    model: 'google/gemini-2.5-flash',
    system: `You are a build-in-public assistant. Generate engaging, authentic social media posts about developer progress.
Keep it concise (under 280 chars for Twitter), authentic, and developer-friendly.
No excessive emojis. Focus on what was built, learned, or shipped. End with relevant hashtags like #buildinpublic #coding.`,
    prompt: `Generate a build-in-public post for this update:\n${context}`,
  })

  return text
}

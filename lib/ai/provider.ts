import { createGoogleGenerativeAI } from '@ai-sdk/google'

/**
 * Shared Google AI provider factory. The project uses GEMINI_API_KEY /
 * GOOGLE_API_KEY, not the AI SDK default GOOGLE_GENERATIVE_AI_API_KEY, so we
 * configure it explicitly.
 */
export function getGoogleProvider() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY
  if (!apiKey)
    throw new Error(
      'Missing Google AI API key (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY)'
    )
  return createGoogleGenerativeAI({ apiKey })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: AI SDK model types require any
export type LanguageModel = any

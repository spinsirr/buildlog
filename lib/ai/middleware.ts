import type { LanguageModelMiddleware } from 'ai'

const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * AI SDK middleware that enforces maxOutputTokens on every LLM call.
 * Prevents runaway token usage.
 */
export const guardrailMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',

  transformParams: async ({ params }) => {
    const maxOutputTokens = params.maxOutputTokens ?? DEFAULT_MAX_TOKENS
    return { ...params, maxOutputTokens }
  },
}

/**
 * Create an AbortSignal that fires after `ms` milliseconds.
 * Use as `abortSignal` in generateText/generateObject calls.
 */
export function timeoutSignal(ms: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms)
}

export { DEFAULT_MAX_TOKENS, DEFAULT_TIMEOUT_MS }

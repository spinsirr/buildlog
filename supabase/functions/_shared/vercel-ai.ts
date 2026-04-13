import { getLog } from "./logger.ts"

const log = getLog("vercel-ai")

const TIMEOUT_MS = 45_000

type VercelAiPath = "generate" | "xhs" | "intro" | "recap" | "decide"

/**
 * Call a Vercel Function AI route from a Supabase Edge Function.
 *
 * Routes live under /api/agent/* on the Next.js side. Auth is a shared
 * secret header (AGENT_API_SECRET). This is the single seam between
 * Deno edge functions and the Vercel AI layer — all content generation,
 * ranking, and recap calls flow through here.
 *
 * Returns `null` on any failure so callers can decide whether to degrade
 * gracefully or error out.
 */
export async function callVercelAi<T>(
  path: VercelAiPath,
  body: Record<string, unknown>,
): Promise<T | null> {
  const appUrl = Deno.env.get("BUILDLOG_APP_URL")
  const secret = Deno.env.get("AGENT_API_SECRET")

  if (!appUrl || !secret) {
    log.warn(
      "Vercel AI not configured (missing BUILDLOG_APP_URL or AGENT_API_SECRET)",
    )
    return null
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${appUrl}/api/agent/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-secret": secret,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      log.error("Vercel AI {path} returned {status}: {body}", {
        path,
        status: res.status,
        body: text.slice(0, 200),
      })
      return null
    }

    return (await res.json()) as T
  } catch (err) {
    log.error("Vercel AI {path} call failed: {error}", {
      path,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

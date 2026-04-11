import { generateObject } from "npm:ai@^6.0.116"
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@^3.0.43"
import { z } from "npm:zod@^4.3.6"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"

const google = createGoogleGenerativeAI({
  apiKey: Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "",
})

const decisionSchema = z.object({
  decision: z.enum(["post", "skip", "bundle_later"]),
  reason: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  angle: z.string().nullable(),
})

Deno.serve(async (req) => {
  const optionsRes = handleOptions(req)
  if (optionsRes) return optionsRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  try {
    const body = await req.json().catch(() => ({})) as { prompt?: string }
    const prompt = body.prompt ??
      "BuildLog shipped scheduled posting for GitHub-driven social updates. Decide if this is worth posting."

    const result = await generateObject({
      model: google(Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash"),
      schema: decisionSchema,
      system:
        "You are deciding whether a software shipping update is worth posting publicly. Return a concise structured judgment.",
      prompt,
    })

    return jsonResponse({ ok: true, object: result.object }, req, { status: 200 })
  } catch (err) {
    return jsonResponse(
      { ok: false, error: String(err), stack: err instanceof Error ? err.stack : null },
      req,
      { status: 500 },
    )
  }
})

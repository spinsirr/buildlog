import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { requireUser } from "../_shared/auth.ts"
import { parsePathParts } from "../_shared/http.ts"

const VALID_PLATFORMS = new Set(["twitter", "linkedin", "bluesky"])

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const parts = parsePathParts(req, "social-disconnect")
  const platform = parts[0]

  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return errorResponse("Invalid platform", 400, req)
  }

  const supabase = createServiceClient()

  await supabase
    .from("platform_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform)

  return jsonResponse({ ok: true }, {}, req)
})

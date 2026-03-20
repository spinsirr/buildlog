import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { requireUser } from "../_shared/auth.ts"
import { safeJson } from "../_shared/http.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const body = await safeJson<{ installation_id?: number }>(req)
  if (!body?.installation_id) {
    return errorResponse("Missing installation_id", 400, req)
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from("profiles")
    .update({ github_installation_id: body.installation_id })
    .eq("id", user.id)

  if (error) return errorResponse(error.message, 500, req)

  return jsonResponse({ ok: true }, {}, req)
})

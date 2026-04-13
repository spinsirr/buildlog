import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2"
import { createServiceClient, createUserClient } from "./supabase.ts"
import { getLog } from "./logger.ts"

const log = getLog("auth")

export function getAuthorizationHeader(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (!auth) return null
  if (!auth.toLowerCase().startsWith("bearer ")) return null
  return auth
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = getAuthorizationHeader(req)
  if (!authHeader) {
    log.warn("no authorization header in request")
    return null
  }

  const jwt = authHeader.replace(/^bearer\s+/i, "")

  // Use user-scoped client per Supabase docs (anon key is auto-provided)
  const supabase = createUserClient(authHeader)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt)

  if (error) {
    log.error("auth.getUser failed: {error}", { error: error.message })
  } else {
    log.info("auth.getUser OK: userId={userId}", { userId: user?.id })
  }

  return user
}

/**
 * Validates user auth and returns a user-scoped Supabase client.
 * The returned client has RLS context set via the Authorization header,
 * so all subsequent queries run as the authenticated user.
 */
export async function requireUser(
  req: Request,
): Promise<{ user: User | null; supabase: SupabaseClient; error?: string }> {
  const authHeader = getAuthorizationHeader(req)
  if (!authHeader) {
    log.warn("no authorization header in request")
    return {
      user: null,
      supabase: createServiceClient(),
      error: "Unauthorized",
    }
  }

  const jwt = authHeader.replace(/^bearer\s+/i, "")
  const supabase = createUserClient(authHeader)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt)

  if (error) {
    log.error("auth.getUser failed: {error}", { error: error.message })
    return { user: null, supabase, error: "Unauthorized" }
  }

  log.info("auth.getUser OK: userId={userId}", { userId: user?.id })
  return { user, supabase }
}

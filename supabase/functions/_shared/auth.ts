import type { User } from "https://esm.sh/@supabase/supabase-js@2"
import { createServiceClient, createUserClient } from "./supabase.ts"

export function getAuthorizationHeader(req: Request): string | null {
  const auth = req.headers.get("authorization")
  if (!auth) return null
  if (!auth.toLowerCase().startsWith("bearer ")) return null
  return auth
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = getAuthorizationHeader(req)
  if (!authHeader) return null

  const supabase = createUserClient(authHeader)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

export async function requireUser(req: Request): Promise<{ user: User | null; error?: string }> {
  const user = await getUserFromRequest(req)
  if (!user) return { user: null, error: "Unauthorized" }
  return { user }
}

export async function getUserFromJwt(jwt: string): Promise<User | null> {
  const supabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(jwt)
  return user
}

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { type Plan, PLANS } from "./plans.ts"
import { createServiceClient } from "./supabase.ts"

export type LimitType = "posts" | "repos" | "platforms"

export async function getUserPlan(userId: string, client?: SupabaseClient): Promise<Plan> {
  const supabase = client ?? createServiceClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .single()

  if (data?.status === "active") return "pro"
  return "free"
}

export async function checkLimit(
  userId: string,
  type: LimitType,
  client?: SupabaseClient,
): Promise<{ allowed: boolean; plan: Plan; count: number; limit: number }> {
  const supabase = client ?? createServiceClient()
  const plan = await getUserPlan(userId, supabase)
  const limits = PLANS[plan]

  let count = 0

  if (type === "posts") {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const { count: c } = await supabase
      .from("posts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth)

    count = c ?? 0
  } else if (type === "repos") {
    const { count: c } = await supabase
      .from("connected_repos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true)

    count = c ?? 0
  } else {
    const { count: c } = await supabase
      .from("platform_connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    count = c ?? 0
  }

  const limit = (limits[`${type}_per_month` as keyof typeof limits] as number | undefined) ??
    (limits[type as keyof typeof limits] as number)

  const allowed = plan === "pro" || count < limit

  return { allowed, plan, count, limit }
}

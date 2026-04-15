import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { type BillingFeatureKey, type BillingState, resolveBillingState } from "./billing.ts"
import { type Plan, PLANS } from "./plans.ts"
import { createServiceClient } from "./supabase.ts"

export type LimitType = "posts" | "repos" | "platforms"

async function fetchSubscriptionRow(
  userId: string,
  client?: SupabaseClient,
) {
  const supabase = client ?? createServiceClient()
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "status, plan_key, access_status, current_period_end, cancel_at_period_end, trial_ends_at, stripe_price_id, price_lookup_key",
    )
    .eq("user_id", userId)
    .maybeSingle()

  return data
}

export async function getUserBillingState(
  userId: string,
  client?: SupabaseClient,
): Promise<BillingState> {
  const subscription = await fetchSubscriptionRow(userId, client)
  return resolveBillingState(subscription)
}

export async function getUserPlan(
  userId: string,
  client?: SupabaseClient,
): Promise<Plan> {
  const billing = await getUserBillingState(userId, client)
  return billing.effectivePlanKey
}

export async function hasEntitlement(
  userId: string,
  featureKey: BillingFeatureKey,
  client?: SupabaseClient,
): Promise<boolean> {
  const billing = await getUserBillingState(userId, client)
  if (billing.features.includes(featureKey)) return true

  const supabase = client ?? createServiceClient()
  const { data } = await supabase
    .from("account_entitlements")
    .select("is_active")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .maybeSingle()

  return data?.is_active === true
}

export async function checkLimit(
  userId: string,
  type: LimitType,
  client?: SupabaseClient,
): Promise<{ allowed: boolean; plan: Plan; count: number; limit: number }> {
  const supabase = client ?? createServiceClient()
  const billing = await getUserBillingState(userId, supabase)
  const plan = billing.effectivePlanKey
  const limits = PLANS[plan]

  let count = 0

  if (type === "posts") {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString()

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

  const limit = (limits[`${type}_per_month` as keyof typeof limits] as
    | number
    | undefined) ??
    (limits[type as keyof typeof limits] as number)

  const allowed = billing.hasPaidAccess || count < limit

  return { allowed, plan, count, limit }
}

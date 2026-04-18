import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { parsePathParts, safeJson, sanitizeReturnUrl } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { getStripe } from "../_shared/stripe.ts"
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2"
import type Stripe from "npm:stripe@18.0.0"

await setupLogger()
const log = getLog("billing")

/**
 * Ensure a valid Stripe customer exists for the user.
 * - If no customer ID on profile → create one
 * - If customer ID exists but is invalid in Stripe → recreate
 * Returns the valid customer ID.
 */
async function ensureCustomer(
  stripe: Stripe,
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("stripe_customer_id, github_username")
    .eq("id", user.id)
    .single()

  if (profileErr || !profile) {
    throw new Error(
      `Failed to fetch profile: ${profileErr?.message ?? "not found"}`,
    )
  }

  let customerId = profile.stripe_customer_id as string | null

  // Verify existing customer is valid
  if (customerId) {
    try {
      const existing = await stripe.customers.retrieve(customerId)
      if (existing.deleted) customerId = null
    } catch {
      log.info("stale customer {cid}, will recreate", { cid: customerId })
      customerId = null
    }
  }

  // Create new customer if needed
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        user_id: user.id,
        github_username: profile?.github_username ?? "",
      },
    })
    customerId = customer.id

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)

    if (updateErr) {
      throw new Error(
        `Failed to save stripe_customer_id: ${updateErr.message}`,
      )
    }

    log.info("created customer {cid} for user {uid}", {
      cid: customerId,
      uid: user.id,
    })
  }

  return customerId
}

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, supabase, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const parts = parsePathParts(req, "billing")
  const action = parts[0]

  const body = await safeJson<{ return_url?: string }>(req)
  const frontendUrl = sanitizeReturnUrl(
    body?.return_url ?? Deno.env.get("FRONTEND_URL") ?? "https://buildlog.ink",
  )
  const stripe = getStripe()

  try {
    if (action === "checkout") {
      const customerId = await ensureCustomer(stripe, supabase, user)

      // Fetch price by lookup key
      const prices = await stripe.prices.list({
        lookup_keys: ["pro_monthly"],
      })
      const priceId = prices.data?.[0]?.id
      if (!priceId) {
        log.error("checkout: no price with lookup_key=pro_monthly found")
        return errorResponse("No Pro plan price found", 500, req)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        // Force English. Stripe's "auto" locale combines Accept-Language with
        // IP geolocation, which served a zh checkout even on English browsers.
        // Our UI is English-only, so the checkout should match.
        locale: "en",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${frontendUrl}/settings?checkout=success`,
        cancel_url: `${frontendUrl}/settings?checkout=canceled`,
        metadata: { user_id: user.id },
        subscription_data: {
          metadata: { user_id: user.id },
        },
      })

      return jsonResponse({ url: session.url }, req, { status: 200 })
    } else if (action === "portal") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single()

      if (!profile?.stripe_customer_id) {
        return errorResponse("No billing account found", 404, req)
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${frontendUrl}/settings`,
        // Same reason as checkout above. Note this also overrides the
        // Billing Portal configuration's default language set in the Stripe
        // Dashboard, which would otherwise win over Accept-Language.
        locale: "en",
      })

      return jsonResponse({ url: session.url }, req, { status: 200 })
    } else {
      return errorResponse("Unknown action", 404, req)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error("billing {action} failed: {msg}", {
      action,
      userId: user.id,
      msg,
    })
    return errorResponse("Internal server error", 500, req)
  }
})

import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { parsePathParts } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { getStripe } from "../_shared/stripe.ts"

await setupLogger()
const log = getLog("billing")

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

  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? Deno.env.get("APP_URL") ??
    "http://localhost:3000"
  const stripe = getStripe()

  try {
    if (action === "checkout") {
      // Fetch user profile to get or create Stripe customer
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("stripe_customer_id, github_username")
        .eq("id", user.id)
        .single()

      if (profileErr || !profile) {
        log.error("checkout: failed to fetch profile", {
          userId: user.id,
          error: String(profileErr),
        })
        return errorResponse("Profile not found", 404, req)
      }

      let customerId = profile.stripe_customer_id

      // Create Stripe customer if one doesn't exist yet
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            user_id: user.id,
            github_username: profile.github_username ?? "",
          },
        })

        customerId = customer.id

        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id)

        if (updateErr) {
          log.error("checkout: failed to save stripe_customer_id", {
            userId: user.id,
            customerId,
            error: String(updateErr),
          })
          return errorResponse("Failed to save customer", 500, req)
        }
      }

      const priceId = Deno.env.get("STRIPE_PRO_PRICE_ID")
      if (!priceId) {
        log.error("checkout: missing STRIPE_PRO_PRICE_ID env var")
        return errorResponse("Billing not configured", 500, req)
      }

      // Set metadata at both session level (for checkout.session.completed) and
      // subscription_data level (for subscription lifecycle events).
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
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
      // Fetch existing Stripe customer ID
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single()

      if (profileErr || !profile) {
        log.error("portal: failed to fetch profile", { userId: user.id, error: String(profileErr) })
        return errorResponse("Profile not found", 404, req)
      }

      if (!profile.stripe_customer_id) {
        return errorResponse("No billing account found", 404, req)
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${frontendUrl}/settings`,
      })

      return jsonResponse({ url: session.url }, req, { status: 200 })
    } else {
      return errorResponse("Unknown action", 404, req)
    }
  } catch (err) {
    log.error("unexpected error: {action}", {
      action,
      userId: user.id,
      error: String(err),
      stack: (err as Error).stack,
    })
    return errorResponse("Internal server error", 500, req)
  }
})

import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { requireUser } from "../_shared/auth.ts"
import { getStripe } from "../_shared/stripe.ts"
import { parsePathParts } from "../_shared/http.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const { user, error: authErr } = await requireUser(req)
  if (!user) return errorResponse(authErr!, 401, req)

  const parts = parsePathParts(req, "billing")
  const action = parts[0]

  const frontendUrl =
    Deno.env.get("FRONTEND_URL") ?? Deno.env.get("APP_URL") ?? "http://localhost:3000"
  const supabase = createServiceClient()
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
        console.error("[billing/checkout] failed to fetch profile", {
          userId: user.id,
          error: profileErr,
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
          console.error("[billing/checkout] failed to save stripe_customer_id", {
            userId: user.id,
            customerId,
            error: updateErr,
          })
          return errorResponse("Failed to save customer", 500, req)
        }

        console.log("[billing/checkout] created Stripe customer", {
          userId: user.id,
          customerId,
        })
      }

      const priceId = Deno.env.get("STRIPE_PRO_PRICE_ID")
      if (!priceId) {
        console.error("[billing/checkout] missing STRIPE_PRO_PRICE_ID env var")
        return errorResponse("Billing not configured", 500, req)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${frontendUrl}/settings?checkout=success`,
        cancel_url: `${frontendUrl}/settings?checkout=canceled`,
        subscription_data: {
          metadata: { user_id: user.id },
        },
      })

      console.log("[billing/checkout] created checkout session", {
        userId: user.id,
        sessionId: session.id,
      })

      return jsonResponse({ url: session.url }, { status: 200 }, req)
    } else if (action === "portal") {
      // Fetch existing Stripe customer ID
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .single()

      if (profileErr || !profile) {
        console.error("[billing/portal] failed to fetch profile", {
          userId: user.id,
          error: profileErr,
        })
        return errorResponse("Profile not found", 404, req)
      }

      if (!profile.stripe_customer_id) {
        return errorResponse("No billing account found", 404, req)
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${frontendUrl}/settings`,
      })

      console.log("[billing/portal] created portal session", {
        userId: user.id,
        customerId: profile.stripe_customer_id,
      })

      return jsonResponse({ url: session.url }, { status: 200 }, req)
    } else {
      return errorResponse("Unknown action", 404, req)
    }
  } catch (err) {
    console.error("[billing] unexpected error", {
      action,
      userId: user.id,
      error: String(err),
      stack: (err as Error).stack,
    })
    return errorResponse("Internal server error", 500, req)
  }
})

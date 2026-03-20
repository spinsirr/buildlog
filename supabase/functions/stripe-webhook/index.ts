import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { getStripe } from "../_shared/stripe.ts"

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig) return errorResponse("Missing stripe-signature", 400, req)

  let event
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    )
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err)
    return errorResponse("Invalid signature", 400, req)
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id
        if (!userId) {
          console.error("[stripe-webhook] missing user_id in subscription metadata", {
            subscriptionId: subscription.id,
          })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single()

        if (!profile) {
          console.error("[stripe-webhook] user_id not found in profiles", { userId })
          break
        }

        // Map status: active/trialing -> 'active', others pass through
        const rawStatus = subscription.status
        const status =
          rawStatus === "active" || rawStatus === "trialing" ? "active" : rawStatus

        const { error } = await supabase
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
              status,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )

        if (error) {
          console.error("[stripe-webhook] failed to upsert subscription", {
            userId,
            subscriptionId: subscription.id,
            error,
          })
        } else {
          console.log("[stripe-webhook] upserted subscription", {
            userId,
            subscriptionId: subscription.id,
            status,
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id
        if (!userId) {
          console.error("[stripe-webhook] missing user_id in subscription metadata", {
            subscriptionId: subscription.id,
          })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single()

        if (!profile) {
          console.error("[stripe-webhook] user_id not found in profiles", { userId })
          break
        }

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)

        if (error) {
          console.error("[stripe-webhook] failed to cancel subscription", {
            userId,
            subscriptionId: subscription.id,
            error,
          })
        } else {
          console.log("[stripe-webhook] canceled subscription", {
            userId,
            subscriptionId: subscription.id,
          })
        }
        break
      }

      case "checkout.session.completed": {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const stripeCustomerId = session.customer as string | null

        if (!userId) {
          console.error("[stripe-webhook] missing user_id in session metadata", {
            sessionId: session.id,
          })
          break
        }

        if (!stripeCustomerId) {
          console.error("[stripe-webhook] missing customer in session", {
            sessionId: session.id,
          })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("id", userId)
          .single()

        if (!profile) {
          console.error("[stripe-webhook] user_id not found in profiles", { userId })
          break
        }

        // Don't overwrite if the user already has a different customer ID
        if (profile.stripe_customer_id && profile.stripe_customer_id !== stripeCustomerId) {
          console.error("[stripe-webhook] user already has a different stripe_customer_id", {
            userId,
            existing: profile.stripe_customer_id,
            incoming: stripeCustomerId,
          })
          break
        }

        const { error } = await supabase
          .from("profiles")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", userId)

        if (error) {
          console.error("[stripe-webhook] failed to sync stripe_customer_id", {
            userId,
            stripeCustomerId,
            error,
          })
        } else {
          console.log("[stripe-webhook] synced stripe_customer_id", {
            userId,
            stripeCustomerId,
          })
        }
        break
      }

      default:
        console.log("[stripe-webhook] unhandled event type", { type: event.type })
    }
  } catch (err) {
    console.error("[stripe-webhook] unexpected error handling event", {
      type: event.type,
      error: String(err),
      stack: (err as Error).stack,
    })
  }

  // Always return 200 to acknowledge receipt — Stripe retries on non-2xx
  return jsonResponse({ received: true }, { status: 200 }, req)
})

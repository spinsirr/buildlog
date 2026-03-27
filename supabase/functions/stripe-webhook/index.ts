import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { getStripe } from "../_shared/stripe.ts"
import { createServiceClient } from "../_shared/supabase.ts"

await setupLogger()
const log = getLog("stripe-webhook")

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
  } catch (_err) {
    log.error("signature verification failed")
    return errorResponse("Invalid signature", 400, req)
  }

  const supabase = createServiceClient()

  // Idempotency: atomic upsert with ignoreDuplicates on the event_id unique constraint.
  // PostgREST translates this to INSERT ... ON CONFLICT DO NOTHING.
  // If the row already exists the insert is a no-op and count will be 0, so we skip processing.
  const { count: insertedCount } = await supabase
    .from("webhook_events")
    .upsert(
      {
        event_id: event.id,
        event_type: event.type,
        source: "stripe",
        processed_at: new Date().toISOString(),
      },
      { onConflict: "event_id", ignoreDuplicates: true, count: "exact" },
    )

  if ((insertedCount ?? 0) === 0) {
    return jsonResponse({ received: true, skipped: "duplicate" }, req, { status: 200 })
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id
        if (!userId) {
          log.error("missing user_id in subscription metadata", { subscriptionId: subscription.id })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single()

        if (!profile) {
          log.error("user_id not found in profiles", { userId })
          break
        }

        // Map status: active/trialing -> 'active', others pass through
        const rawStatus = subscription.status
        const status = rawStatus === "active" || rawStatus === "trialing" ? "active" : rawStatus

        const { error } = await supabase.from("subscriptions").upsert(
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
          log.error("failed to upsert subscription", {
            userId,
            subscriptionId: subscription.id,
            error: String(error),
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object
        const userId = subscription.metadata?.user_id
        if (!userId) {
          log.error("missing user_id in subscription metadata", { subscriptionId: subscription.id })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .single()

        if (!profile) {
          log.error("user_id not found in profiles", { userId })
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
          log.error("failed to cancel subscription", {
            userId,
            subscriptionId: subscription.id,
            error: String(error),
          })
        }
        break
      }

      case "invoice.payment_failed": {
        // Payment failed — mark the subscription as past_due (or whatever Stripe reports)
        const invoice = event.data.object
        const failedSubId = invoice.subscription as string | null

        if (!failedSubId) {
          log.error("invoice.payment_failed: no subscription on invoice", { invoiceId: invoice.id })
          break
        }

        // Retrieve the subscription from Stripe to get the current status
        const failedSub = await getStripe().subscriptions.retrieve(failedSubId)
        const failedStatus = failedSub.status ?? "past_due"

        const { error } = await supabase
          .from("subscriptions")
          .update({
            status: failedStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", failedSubId)

        if (error) {
          log.error("invoice.payment_failed: failed to update subscription status", {
            subscriptionId: failedSubId,
            status: failedStatus,
            error: String(error),
          })
        } else {
          log.info("invoice.payment_failed: subscription marked as {status}", {
            subscriptionId: failedSubId,
            status: failedStatus,
            invoiceId: invoice.id,
          })
        }
        break
      }

      case "checkout.session.completed": {
        const session = event.data.object
        const userId = session.metadata?.user_id
        const stripeCustomerId = session.customer as string | null

        if (!userId) {
          log.error("missing user_id in session metadata", { sessionId: session.id })
          break
        }

        if (!stripeCustomerId) {
          log.error("missing customer in session", { sessionId: session.id })
          break
        }

        // Validate user exists in profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("id", userId)
          .single()

        if (!profile) {
          log.error("user_id not found in profiles", { userId })
          break
        }

        // Don't overwrite if the user already has a different customer ID
        if (profile.stripe_customer_id && profile.stripe_customer_id !== stripeCustomerId) {
          log.error("user already has a different stripe_customer_id", {
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
          log.error("failed to sync stripe_customer_id", {
            userId,
            stripeCustomerId,
            error: String(error),
          })
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    log.error("unexpected error handling event: {type}", {
      type: event.type,
      error: String(err),
      stack: (err as Error).stack,
    })
  }

  // Always return 200 to acknowledge receipt — Stripe retries on non-2xx
  return jsonResponse({ received: true }, req, { status: 200 })
})

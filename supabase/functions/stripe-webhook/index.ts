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

  // Resolve user_id: prefer metadata, fall back to stripe_customer_id lookup
  async function resolveUserId(
    metadata: Record<string, string> | undefined,
    customerId: string | null,
    context: string,
  ): Promise<string | null> {
    if (metadata?.user_id) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", metadata.user_id)
        .single()
      if (data) return data.id
      log.error(`${context}: user_id from metadata not found in profiles`, {
        userId: metadata.user_id,
      })
    }

    if (customerId) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single()
      if (data) {
        log.info(`${context}: resolved user via stripe_customer_id fallback`, {
          customerId,
          userId: data.id,
        })
        return data.id
      }
    }

    log.error(`${context}: could not resolve user`, {
      hasMetadata: !!metadata?.user_id,
      hasCustomerId: !!customerId,
    })
    return null
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object
        const userId = await resolveUserId(
          subscription.metadata,
          subscription.customer as string | null,
          event.type,
        )
        if (!userId) break

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
        const userId = await resolveUserId(
          subscription.metadata,
          subscription.customer as string | null,
          "subscription.deleted",
        )
        if (!userId) break

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
        const stripeCustomerId = session.customer as string | null
        const userId = await resolveUserId(
          session.metadata,
          stripeCustomerId,
          "checkout.session.completed",
        )
        if (!userId) break

        if (stripeCustomerId) {
          // Sync stripe_customer_id to profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", userId)
            .single()

          if (profile && !profile.stripe_customer_id) {
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
          }
        }

        // Also create subscription row if checkout was for a subscription
        const subscriptionId = session.subscription as string | null
        if (subscriptionId) {
          const sub = await getStripe().subscriptions.retrieve(subscriptionId)
          const rawStatus = sub.status
          const status = rawStatus === "active" || rawStatus === "trialing" ? "active" : rawStatus

          const { error } = await supabase.from("subscriptions").upsert(
            {
              user_id: userId,
              stripe_subscription_id: sub.id,
              stripe_price_id: sub.items?.data?.[0]?.price?.id ?? null,
              status,
              current_period_end: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )

          if (error) {
            log.error("checkout: failed to upsert subscription", {
              userId,
              subscriptionId: sub.id,
              error: String(error),
            })
          } else {
            log.info("checkout: subscription created via checkout fallback", {
              userId,
              subscriptionId: sub.id,
              status,
            })
          }
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

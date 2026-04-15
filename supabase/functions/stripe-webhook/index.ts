import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { getConfiguredPlanKey, resolveBillingState } from "../_shared/billing.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { getStripe } from "../_shared/stripe.ts"
import { createServiceClient } from "../_shared/supabase.ts"

await setupLogger()
const log = getLog("stripe-webhook")

type StripeMetadata = Record<string, string> | undefined

type StripeActiveEntitlement = {
  id: string
  "lookup_key"?: string
}

function getStripeSecretKey(): string {
  const key = Deno.env.get("STRIPE_SECRET_KEY")
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY")
  return key
}

function toIso(timestampSeconds?: number | null): string | null {
  return timestampSeconds ? new Date(timestampSeconds * 1000).toISOString() : null
}

async function resolveUserId(
  metadata: StripeMetadata,
  customerId: string | null,
  context: string,
) {
  const supabase = createServiceClient()

  if (metadata?.user_id) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", metadata.user_id)
      .maybeSingle()
    if (data?.id) return data.id
    log.error(`${context}: user_id from metadata not found`, {
      userId: metadata.user_id,
    })
  }

  if (customerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle()
    if (data?.id) {
      log.info(`${context}: resolved via stripe_customer_id fallback`, {
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

async function syncStripeCustomerId(userId: string, customerId: string | null) {
  if (!customerId) return

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.stripe_customer_id === customerId) return

  const { error } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId)

  if (error) {
    log.error("failed to sync stripe_customer_id", {
      userId,
      customerId,
      error: String(error),
    })
  }
}

async function upsertSubscriptionFromStripeSubscription(
  subscription: {
    id: string
    customer: string | null
    status?: string | null
    metadata?: StripeMetadata
    current_period_end?: number | null
    cancel_at_period_end?: boolean | null
    trial_end?: number | null
    latest_invoice?: string | null
    items?: {
      data?: Array<{
        price?: {
          id?: string | null
          lookup_key?: string | null
        } | null
      }>
    } | null
  },
  context: string,
) {
  const customerId = subscription.customer ?? null
  const userId = await resolveUserId(subscription.metadata, customerId, context)
  if (!userId) return

  await syncStripeCustomerId(userId, customerId)

  const firstPrice = subscription.items?.data?.[0]?.price ?? null
  const record = {
    "user_id": userId,
    "stripe_subscription_id": subscription.id,
    "stripe_price_id": firstPrice?.id ?? null,
    "price_lookup_key": subscription.metadata?.price_lookup_key ?? firstPrice?.lookup_key ?? null,
    "plan_key": subscription.metadata?.plan_key ??
      getConfiguredPlanKey({
        status: subscription.status ?? null,
        "price_lookup_key": firstPrice?.lookup_key ?? null,
      }),
    status: subscription.status ?? "inactive",
    "current_period_end": toIso(subscription.current_period_end),
    "cancel_at_period_end": subscription.cancel_at_period_end === true,
    "trial_ends_at": toIso(subscription.trial_end),
    "last_invoice_id": subscription.latest_invoice ?? null,
    "updated_at": new Date().toISOString(),
  }

  const billingState = resolveBillingState(record)

  const supabase = createServiceClient()
  const { error } = await supabase.from("subscriptions").upsert(
    {
      ...record,
      "access_status": billingState.accessStatus,
    },
    { onConflict: "user_id" },
  )

  if (error) {
    log.error(`${context}: failed to upsert subscription`, {
      userId,
      subscriptionId: subscription.id,
      error: String(error),
    })
  }
}

async function listActiveEntitlements(customerId: string): Promise<StripeActiveEntitlement[]> {
  const authHeader = `Basic ${btoa(`${getStripeSecretKey()}:`)}`
  const url = `https://api.stripe.com/v1/entitlements/active_entitlements?customer=${
    encodeURIComponent(customerId)
  }&limit=100`
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Stripe entitlements list failed (${response.status}): ${text}`)
  }

  const payload = await response.json() as {
    data?: Array<{ id: string; lookup_key?: string }>
  }
  return (payload.data ?? []).filter((item) => !!item.lookup_key)
}

async function syncEntitlementsForCustomer(
  userId: string,
  customerId: string | null,
  eventId: string,
) {
  const supabase = createServiceClient()

  const { data: existingRows } = await supabase
    .from("account_entitlements")
    .select("feature_key")
    .eq("user_id", userId)

  if (!customerId) {
    await supabase
      .from("account_entitlements")
      .update({
        is_active: false,
        source_event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
    return
  }

  const entitlements = await listActiveEntitlements(customerId)
  const activeKeys = entitlements
    .map((entitlement) => entitlement.lookup_key)
    .filter((key): key is string => typeof key === "string" && key.length > 0)
  const staleKeys = (existingRows ?? [])
    .map((row) => row.feature_key)
    .filter((featureKey): featureKey is string => !activeKeys.includes(featureKey))

  if (activeKeys.length > 0) {
    const { error } = await supabase.from("account_entitlements").upsert(
      activeKeys.map((featureKey) => ({
        user_id: userId,
        feature_key: featureKey,
        is_active: true,
        source: "stripe",
        source_event_id: eventId,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,feature_key" },
    )

    if (error) {
      log.error("failed to upsert entitlements", {
        userId,
        customerId,
        error: String(error),
      })
    }
  }

  if (staleKeys.length > 0) {
    const { error: deactivateError } = await supabase
      .from("account_entitlements")
      .update({
        is_active: false,
        source_event_id: eventId,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .in("feature_key", staleKeys)

    if (deactivateError) {
      log.error("failed to deactivate stale entitlements", {
        userId,
        customerId,
        error: String(deactivateError),
      })
    }
  }
}

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
  } catch {
    log.error("signature verification failed")
    return errorResponse("Invalid signature", 400, req)
  }

  const supabase = createServiceClient()
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
    return jsonResponse({ received: true, skipped: "duplicate" }, req, {
      status: 200,
    })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object
        const customerId = session.customer as string | null
        const userId = await resolveUserId(
          session.metadata,
          customerId,
          "checkout.session.completed",
        )
        if (!userId) break

        await syncStripeCustomerId(userId, customerId)

        const subscriptionId = session.subscription as string | null
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          await upsertSubscriptionFromStripeSubscription(
            {
              id: subscription.id,
              customer: subscription.customer as string | null,
              status: subscription.status,
              metadata: subscription.metadata,
              current_period_end: subscription.current_period_end,
              cancel_at_period_end: subscription.cancel_at_period_end,
              trial_end: subscription.trial_end,
              latest_invoice: subscription.latest_invoice as string | null,
              items: subscription.items,
            },
            "checkout.session.completed",
          )
        }

        await syncEntitlementsForCustomer(userId, customerId, event.id)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscription = event.data.object
        await upsertSubscriptionFromStripeSubscription(
          {
            id: subscription.id,
            customer: subscription.customer as string | null,
            status: subscription.status,
            metadata: subscription.metadata,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end,
            latest_invoice: subscription.latest_invoice as string | null,
            items: subscription.items,
          },
          event.type,
        )

        const userId = await resolveUserId(
          subscription.metadata,
          subscription.customer as string | null,
          event.type,
        )
        if (userId) {
          await syncEntitlementsForCustomer(
            userId,
            subscription.customer as string | null,
            event.id,
          )
        }
        break
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription as string | null
        if (!subscriptionId) break

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
        await upsertSubscriptionFromStripeSubscription(
          {
            id: subscription.id,
            customer: subscription.customer as string | null,
            status: subscription.status,
            metadata: subscription.metadata,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end,
            latest_invoice: invoice.id as string | null,
            items: subscription.items,
          },
          event.type,
        )

        const userId = await resolveUserId(
          subscription.metadata,
          subscription.customer as string | null,
          event.type,
        )
        if (userId) {
          await syncEntitlementsForCustomer(
            userId,
            subscription.customer as string | null,
            event.id,
          )
        }
        break
      }

      case "entitlements.active_entitlement_summary.updated": {
        const summary = event.data.object
        const customerId = summary.customer as string | null
        const userId = await resolveUserId(
          summary.metadata as StripeMetadata,
          customerId,
          event.type,
        )
        if (!userId) break
        await syncEntitlementsForCustomer(userId, customerId, event.id)
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

  return jsonResponse({ received: true }, req, { status: 200 })
})

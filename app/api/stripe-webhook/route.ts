import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// Helper to safely extract period end from subscription object
function getPeriodEnd(sub: Record<string, unknown>): string | null {
  const val = sub.current_period_end as number | undefined
  return val ? new Date(val * 1000).toISOString() : null
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotency check
  const { count } = await supabase.from('webhook_events').upsert(
    {
      event_id: event.id,
      event_type: event.type,
      source: 'stripe',
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'event_id', ignoreDuplicates: true, count: 'exact' }
  )

  if ((count ?? 0) === 0) {
    return NextResponse.json({ received: true, skipped: 'duplicate' })
  }

  async function resolveUserId(
    metadata: Record<string, string> | undefined,
    customerId: string | null
  ): Promise<string | null> {
    if (metadata?.user_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', metadata.user_id)
        .single()
      if (data) return data.id
    }
    if (customerId) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
      if (data) return data.id
    }
    return null
  }

  // Use record type for dynamic Stripe event objects
  const obj = event.data.object as unknown as Record<string, unknown>

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const userId = await resolveUserId(
          obj.metadata as Record<string, string> | undefined,
          obj.customer as string | null
        )
        if (!userId) break

        const rawStatus = obj.status as string
        const status = rawStatus === 'active' || rawStatus === 'trialing' ? 'active' : rawStatus
        const items = obj.items as { data: Array<{ price: { id: string } }> } | undefined

        await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            stripe_subscription_id: obj.id as string,
            stripe_price_id: items?.data?.[0]?.price?.id ?? null,
            status,
            current_period_end: getPeriodEnd(obj),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        break
      }

      case 'customer.subscription.deleted': {
        const userId = await resolveUserId(
          obj.metadata as Record<string, string> | undefined,
          obj.customer as string | null
        )
        if (!userId) break

        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        break
      }

      case 'invoice.payment_failed': {
        const failedSubId = obj.subscription as string | null
        if (!failedSubId) break

        const failedSub = await stripe.subscriptions.retrieve(failedSubId)
        const subObj = failedSub as unknown as Record<string, unknown>
        await supabase
          .from('subscriptions')
          .update({
            status: (subObj.status as string) ?? 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', failedSubId)
        break
      }

      case 'checkout.session.completed': {
        const stripeCustomerId = obj.customer as string | null
        const userId = await resolveUserId(
          obj.metadata as Record<string, string> | undefined,
          stripeCustomerId
        )
        if (!userId) break

        if (stripeCustomerId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single()

          if (profile && !profile.stripe_customer_id) {
            await supabase
              .from('profiles')
              .update({ stripe_customer_id: stripeCustomerId })
              .eq('id', userId)
          }
        }

        const subscriptionId = obj.subscription as string | null
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const subObj = sub as unknown as Record<string, unknown>
          const rawStatus = subObj.status as string
          const status = rawStatus === 'active' || rawStatus === 'trialing' ? 'active' : rawStatus
          const items = subObj.items as { data: Array<{ price: { id: string } }> } | undefined

          await supabase.from('subscriptions').upsert(
            {
              user_id: userId,
              stripe_subscription_id: subObj.id as string,
              stripe_price_id: items?.data?.[0]?.price?.id ?? null,
              status,
              current_period_end: getPeriodEnd(subObj),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
        }
        break
      }
    }
  } catch (err) {
    console.error('Stripe webhook error:', err)
  }

  return NextResponse.json({ received: true })
}

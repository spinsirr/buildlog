import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata.user_id
      if (!userId) break

      // Verify user_id exists in our database before trusting metadata
      const { data: subProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()
      if (!subProfile) break

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_price_id: sub.items.data[0]?.price.id,
        status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata.user_id
      if (!userId) break

      // Verify user_id exists before trusting metadata
      const { data: delProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()
      if (!delProfile) break

      await supabase.from('subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // subscription webhook above handles the actual activation,
      // but sync customer_id to profile in case it wasn't set yet
      if (session.customer && session.metadata?.user_id) {
        const userId = session.metadata.user_id
        const customerId = session.customer as string

        // Validate: verify the user_id actually exists in our database
        // and that this customer_id isn't already linked to a different user
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, stripe_customer_id')
          .eq('id', userId)
          .single()

        if (!profile) {
          // user_id from metadata doesn't match any profile — skip
          break
        }

        // If profile already has a different customer_id, don't overwrite
        if (profile.stripe_customer_id && profile.stripe_customer_id !== customerId) {
          break
        }

        await supabase.from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
      }
      break
    }
  }

  return NextResponse.json({ ok: true })
}

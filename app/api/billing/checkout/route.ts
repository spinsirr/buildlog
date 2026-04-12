import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const returnUrl = body.return_url || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('stripe_customer_id, github_username')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const stripe = getStripe()
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email!,
      metadata: { user_id: user.id, github_username: profile.github_username ?? '' },
    })
    customerId = customer.id

    await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID
  if (!priceId) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 500 })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}/settings?checkout=success`,
    cancel_url: `${returnUrl}/settings?checkout=canceled`,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
  })

  return NextResponse.json({ url: session.url })
}

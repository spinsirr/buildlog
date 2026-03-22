import Stripe from 'https://esm.sh/stripe@20.4.1?target=deno'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) throw new Error('Missing required environment variable: STRIPE_SECRET_KEY')

    stripe = new Stripe(key, {
      apiVersion: '2026-02-25.clover',
      httpClient: Stripe.createFetchHttpClient(),
    })
  }

  return stripe
}

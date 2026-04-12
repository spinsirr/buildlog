import Stripe from "npm:stripe@18.0.0"

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    const key = Deno.env.get("STRIPE_SECRET_KEY")
    if (!key) throw new Error("Missing required environment variable: STRIPE_SECRET_KEY")

    stripe = new Stripe(key)
  }

  return stripe
}

import Stripe from 'stripe'

export { PLANS, type Plan } from '@/lib/plans'

let _stripe: Stripe | null = null

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!
export const STRIPE_PRO_AMOUNT = 999 // $9.99

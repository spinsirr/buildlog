import { BILLING_PLANS, type BillingPlanKey } from '@/lib/billing'

export const PLANS = {
  free: {
    name: BILLING_PLANS.free.name,
    posts_per_month: BILLING_PLANS.free.limits.postsPerMonth,
    repos: BILLING_PLANS.free.limits.repos,
    platforms: BILLING_PLANS.free.limits.platforms,
  },
  pro: {
    name: BILLING_PLANS.pro.name,
    posts_per_month: BILLING_PLANS.pro.limits.postsPerMonth,
    repos: BILLING_PLANS.pro.limits.repos,
    platforms: BILLING_PLANS.pro.limits.platforms,
  },
} as const

export type Plan = BillingPlanKey

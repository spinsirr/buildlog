export const BILLING_PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    stripeLookupKey: null,
    limits: {
      postsPerMonth: 5,
      repos: 1,
      platforms: 1,
    },
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    stripeLookupKey: 'pro_monthly',
    limits: {
      postsPerMonth: Number.POSITIVE_INFINITY,
      repos: Number.POSITIVE_INFINITY,
      platforms: Number.POSITIVE_INFINITY,
    },
  },
} as const

export type BillingPlanKey = keyof typeof BILLING_PLANS
export type BillingAccessStatus = 'free' | 'pro' | 'grace_period' | 'suspended'
export type BillingFeatureKey =
  | 'unlimited_posts'
  | 'unlimited_repos'
  | 'multi_platform_publish'
  | 'twitter_publish'
  | 'weekly_recaps'
  | 'branch_recaps'
  | 'priority_support'

export const PLAN_FEATURES: Record<BillingPlanKey, BillingFeatureKey[]> = {
  free: [],
  pro: [
    'unlimited_posts',
    'unlimited_repos',
    'multi_platform_publish',
    'twitter_publish',
    'weekly_recaps',
    'branch_recaps',
    'priority_support',
  ],
}

export type BillingSubscriptionRecord = {
  access_status?: BillingAccessStatus | null
  status?: string | null
  plan_key?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  trial_ends_at?: string | null
  stripe_price_id?: string | null
  price_lookup_key?: string | null
}

export type BillingState = {
  configuredPlanKey: BillingPlanKey
  effectivePlanKey: BillingPlanKey
  accessStatus: BillingAccessStatus
  hasPaidAccess: boolean
  isInGracePeriod: boolean
  features: BillingFeatureKey[]
  stripeStatus: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  stripePriceId: string | null
  priceLookupKey: string | null
}

function isPlanKey(value: string | null | undefined): value is BillingPlanKey {
  return value === 'free' || value === 'pro'
}

export function getConfiguredPlanKey(
  subscription: BillingSubscriptionRecord | null | undefined
): BillingPlanKey {
  if (!subscription) return 'free'

  if (isPlanKey(subscription.plan_key)) {
    return subscription.plan_key
  }

  if (subscription.price_lookup_key === BILLING_PLANS.pro.stripeLookupKey) {
    return 'pro'
  }

  if (subscription.status) {
    return 'pro'
  }

  return 'free'
}

function hasFuturePeriodEnd(currentPeriodEnd: string | null | undefined, nowMs: number): boolean {
  if (!currentPeriodEnd) return false
  const parsed = Date.parse(currentPeriodEnd)
  return Number.isFinite(parsed) && parsed > nowMs
}

function getEffectivePlanKeyFromAccessStatus(accessStatus: BillingAccessStatus): BillingPlanKey {
  return accessStatus === 'pro' || accessStatus === 'grace_period' ? 'pro' : 'free'
}

export function resolveBillingState(
  subscription: BillingSubscriptionRecord | null | undefined,
  now = new Date()
): BillingState {
  const nowMs = now.getTime()

  if (!subscription) {
    return {
      configuredPlanKey: 'free',
      effectivePlanKey: 'free',
      accessStatus: 'free',
      hasPaidAccess: false,
      isInGracePeriod: false,
      features: [],
      stripeStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      stripePriceId: null,
      priceLookupKey: null,
    }
  }

  const configuredPlanKey = getConfiguredPlanKey(subscription)
  const stripeStatus = subscription.status ?? null
  const currentPeriodEnd = subscription.current_period_end ?? null
  const cancelAtPeriodEnd = subscription.cancel_at_period_end === true
  const trialEndsAt = subscription.trial_ends_at ?? null
  const normalizedAccessStatus = subscription.access_status ?? null
  const hasRemainingAccess = hasFuturePeriodEnd(currentPeriodEnd, nowMs)

  let accessStatus: BillingAccessStatus = 'free'
  let effectivePlanKey: BillingPlanKey = 'free'

  if (normalizedAccessStatus) {
    accessStatus = normalizedAccessStatus
    effectivePlanKey = getEffectivePlanKeyFromAccessStatus(normalizedAccessStatus)
  } else if (configuredPlanKey === 'pro') {
    if (stripeStatus === 'active' || stripeStatus === 'trialing') {
      accessStatus = 'pro'
      effectivePlanKey = 'pro'
    } else if (stripeStatus === 'past_due') {
      accessStatus = 'grace_period'
      effectivePlanKey = 'pro'
    } else if (stripeStatus === 'canceled' && hasRemainingAccess) {
      accessStatus = 'grace_period'
      effectivePlanKey = 'pro'
    } else if (
      stripeStatus === 'unpaid' ||
      stripeStatus === 'incomplete' ||
      stripeStatus === 'incomplete_expired' ||
      stripeStatus === 'paused'
    ) {
      accessStatus = 'suspended'
      effectivePlanKey = 'free'
    }
  }

  return {
    configuredPlanKey,
    effectivePlanKey,
    accessStatus,
    hasPaidAccess: effectivePlanKey !== 'free',
    isInGracePeriod: accessStatus === 'grace_period',
    features: PLAN_FEATURES[effectivePlanKey],
    stripeStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    trialEndsAt,
    stripePriceId: subscription.stripe_price_id ?? null,
    priceLookupKey: subscription.price_lookup_key ?? null,
  }
}

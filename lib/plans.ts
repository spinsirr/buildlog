export const PLANS = {
  free: {
    name: 'Free',
    posts_per_month: 20,
    repos: 1,
    platforms: 1,
  },
  pro: {
    name: 'Pro',
    posts_per_month: Infinity,
    repos: Infinity,
    platforms: Infinity,
  },
} as const

export type Plan = keyof typeof PLANS

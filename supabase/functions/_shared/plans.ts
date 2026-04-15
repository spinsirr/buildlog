export const PLANS = {
  free: {
    name: "Free",
    posts_per_month: 5,
    repos: 1,
    platforms: 1,
  },
  pro: {
    name: "Pro",
    posts_per_month: Number.POSITIVE_INFINITY,
    repos: Number.POSITIVE_INFINITY,
    platforms: Number.POSITIVE_INFINITY,
  },
} as const

export type Plan = keyof typeof PLANS

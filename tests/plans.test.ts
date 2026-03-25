import { describe, expect, it } from 'vitest'
import { PLANS } from '../supabase/functions/_shared/plans'

describe('PLANS', () => {
  it('free plan has finite limits', () => {
    expect(PLANS.free.posts_per_month).toBe(10)
    expect(PLANS.free.repos).toBe(1)
    expect(PLANS.free.platforms).toBe(1)
  })

  it('pro plan has unlimited everything', () => {
    expect(PLANS.pro.posts_per_month).toBe(Infinity)
    expect(PLANS.pro.repos).toBe(Infinity)
    expect(PLANS.pro.platforms).toBe(Infinity)
  })

  it('only has free and pro plans', () => {
    expect(Object.keys(PLANS)).toEqual(['free', 'pro'])
  })
})

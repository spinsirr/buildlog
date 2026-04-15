import { describe, expect, it } from 'vitest'
import { resolveBillingState } from '../lib/billing'

describe('resolveBillingState', () => {
  const now = new Date('2026-04-14T12:00:00.000Z')

  it('grants pro access for active subscriptions', () => {
    const billing = resolveBillingState(
      {
        status: 'active',
        plan_key: 'pro',
        current_period_end: '2026-05-01T00:00:00.000Z',
      },
      now
    )

    expect(billing.accessStatus).toBe('pro')
    expect(billing.effectivePlanKey).toBe('pro')
    expect(billing.hasPaidAccess).toBe(true)
  })

  it('keeps paid access during grace period', () => {
    const billing = resolveBillingState(
      {
        status: 'past_due',
        plan_key: 'pro',
        current_period_end: '2026-05-01T00:00:00.000Z',
      },
      now
    )

    expect(billing.accessStatus).toBe('grace_period')
    expect(billing.effectivePlanKey).toBe('pro')
    expect(billing.isInGracePeriod).toBe(true)
  })

  it('drops access for suspended subscription states', () => {
    const billing = resolveBillingState(
      {
        status: 'unpaid',
        plan_key: 'pro',
        current_period_end: '2026-05-01T00:00:00.000Z',
      },
      now
    )

    expect(billing.accessStatus).toBe('suspended')
    expect(billing.effectivePlanKey).toBe('free')
    expect(billing.hasPaidAccess).toBe(false)
  })

  it('keeps canceled subscriptions active until current period ends', () => {
    const billing = resolveBillingState(
      {
        status: 'canceled',
        plan_key: 'pro',
        current_period_end: '2026-04-20T00:00:00.000Z',
      },
      now
    )

    expect(billing.accessStatus).toBe('grace_period')
    expect(billing.effectivePlanKey).toBe('pro')
  })

  it('falls back to free after canceled access has expired', () => {
    const billing = resolveBillingState(
      {
        status: 'canceled',
        plan_key: 'pro',
        current_period_end: '2026-04-01T00:00:00.000Z',
      },
      now
    )

    expect(billing.accessStatus).toBe('free')
    expect(billing.effectivePlanKey).toBe('free')
  })
})

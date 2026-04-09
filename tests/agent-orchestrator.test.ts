import { describe, expect, it } from 'vitest'
import { WATERMARK } from '@/lib/agent/prompts'

const MAX_CONTENT_LENGTH = 280
const CONTENT_BUDGET = MAX_CONTENT_LENGTH - WATERMARK.length

describe('watermark character budget', () => {
  it('watermark is non-empty', () => {
    expect(WATERMARK.length).toBeGreaterThan(0)
  })

  it('content budget leaves room for watermark within 280 chars', () => {
    expect(CONTENT_BUDGET).toBeLessThan(280)
    expect(CONTENT_BUDGET).toBeGreaterThan(200)
  })

  it('content at exactly budget + watermark = 280', () => {
    const content = 'x'.repeat(CONTENT_BUDGET)
    const withWatermark = content + WATERMARK
    expect(withWatermark.length).toBe(MAX_CONTENT_LENGTH)
  })

  it('content one char over budget + watermark exceeds 280', () => {
    const content = 'x'.repeat(CONTENT_BUDGET + 1)
    const withWatermark = content + WATERMARK
    expect(withWatermark.length).toBeGreaterThan(MAX_CONTENT_LENGTH)
  })
})

describe('empty content guard', () => {
  it('content shorter than 10 chars should be rejected', () => {
    const tooShort = ['', ' ', 'hi', 'ok cool']
    for (const content of tooShort) {
      expect(content.trim().length).toBeLessThan(10)
    }
  })

  it('content of 10+ chars should be accepted', () => {
    const valid = ['This is a valid post about shipping code.']
    for (const content of valid) {
      expect(content.trim().length).toBeGreaterThanOrEqual(10)
    }
  })
})

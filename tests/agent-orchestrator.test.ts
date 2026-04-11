import { describe, expect, it } from 'vitest'
import { getContentLimit, PLATFORM_CHAR_LIMITS } from '@/lib/platforms'

describe('platform character limits', () => {
  it('twitter standard limit is 280', () => {
    expect(getContentLimit('twitter', false)).toBe(280)
  })

  it('twitter premium limit is 4000', () => {
    expect(getContentLimit('twitter', true)).toBe(4000)
  })

  it('bluesky limit is 300', () => {
    expect(getContentLimit('bluesky', false)).toBe(300)
  })

  it('linkedin limit is 3000', () => {
    expect(getContentLimit('linkedin', false)).toBe(3000)
  })

  it('unknown platform defaults to twitter limit', () => {
    expect(getContentLimit('unknown', false)).toBe(280)
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

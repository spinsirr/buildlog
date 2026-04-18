import { describe, expect, it } from 'vitest'
import { anyPlatformOverLimit, contentForPlatform, resolvePlatformContent } from '@/lib/posts'

// Tests cover the per-platform content resolution helpers that now gate the
// publish button. The P1 codex finding on PR #23 was that a long LinkedIn
// default blocked publish even when shorter variants existed for stricter
// platforms — these assertions pin down the fix.

function makePost(
  overrides: { content?: string; platform_variants?: Record<string, string> | null } = {}
) {
  return {
    content: overrides.content ?? 'default body',
    platform_variants: overrides.platform_variants ?? null,
  }
}

describe('contentForPlatform', () => {
  it('returns the variant when present', () => {
    const post = makePost({ platform_variants: { twitter: 'short tweet' } })
    expect(contentForPlatform(post, 'twitter')).toBe('short tweet')
  })

  it('falls back to default when no variant for that platform', () => {
    const post = makePost({
      content: 'fallback',
      platform_variants: { linkedin: 'long post' },
    })
    expect(contentForPlatform(post, 'twitter')).toBe('fallback')
  })

  it('falls back when the variant is an empty string', () => {
    const post = makePost({
      content: 'fallback',
      platform_variants: { twitter: '' },
    })
    expect(contentForPlatform(post, 'twitter')).toBe('fallback')
  })

  it('falls back when platform_variants is null', () => {
    const post = makePost({ content: 'only default', platform_variants: null })
    expect(contentForPlatform(post, 'bluesky')).toBe('only default')
  })
})

describe('resolvePlatformContent', () => {
  it('builds a full map with variants preferred', () => {
    const post = makePost({
      content: 'default',
      platform_variants: { twitter: 'tweet', linkedin: 'long' },
    })
    expect(resolvePlatformContent(post, ['twitter', 'linkedin', 'bluesky'])).toEqual({
      twitter: 'tweet',
      linkedin: 'long',
      bluesky: 'default',
    })
  })
})

describe('anyPlatformOverLimit', () => {
  it('returns false when default content fits every connected platform', () => {
    const post = makePost({ content: 'hi' })
    expect(anyPlatformOverLimit(post, ['twitter', 'linkedin', 'bluesky'], false)).toBe(false)
  })

  it('returns false when a long LinkedIn default is paired with valid Twitter/Bluesky variants', () => {
    // This is the core P1 regression: long default was blocking publish even
    // though stricter platforms had their own short variants.
    const post = makePost({
      content: 'x'.repeat(1500), // fits LinkedIn (3000) but way over Twitter/Bluesky
      platform_variants: {
        twitter: 'short tweet', // well under 280
        bluesky: 'short skeet', // well under 300
      },
    })
    expect(anyPlatformOverLimit(post, ['twitter', 'linkedin', 'bluesky'], false)).toBe(false)
  })

  it('returns true when a variant itself exceeds its platform limit', () => {
    const post = makePost({
      content: 'ok default',
      platform_variants: {
        twitter: 'x'.repeat(300), // over Twitter's 280
      },
    })
    expect(anyPlatformOverLimit(post, ['twitter'], false)).toBe(true)
  })

  it('returns true when default is used for a platform and exceeds that platform limit', () => {
    const post = makePost({ content: 'x'.repeat(400) }) // over Twitter (280) and Bluesky (300)
    expect(anyPlatformOverLimit(post, ['twitter'], false)).toBe(true)
    expect(anyPlatformOverLimit(post, ['bluesky'], false)).toBe(true)
    expect(anyPlatformOverLimit(post, ['linkedin'], false)).toBe(false)
  })

  it('respects xPremium for the Twitter limit', () => {
    const post = makePost({ content: 'x'.repeat(500) })
    // Non-premium Twitter limit is 280, so 500 is over.
    expect(anyPlatformOverLimit(post, ['twitter'], false)).toBe(true)
    // Premium bumps Twitter to 4000, so 500 fits.
    expect(anyPlatformOverLimit(post, ['twitter'], true)).toBe(false)
  })

  it('returns false when connectedPlatforms is empty', () => {
    const post = makePost({ content: 'x'.repeat(5000) })
    expect(anyPlatformOverLimit(post, [], false)).toBe(false)
  })
})

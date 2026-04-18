import { getContentLimit } from './platforms'
import type { Post } from './types'

type VariantSource = Pick<Post, 'content' | 'platform_variants'>

/**
 * Resolve the content string to use when publishing to a given platform.
 * Returns the per-platform variant if one exists, otherwise the default content.
 */
export function contentForPlatform(post: VariantSource, platform: string): string {
  const variant = post.platform_variants?.[platform]
  if (typeof variant === 'string' && variant.length > 0) return variant
  return post.content
}

/**
 * Build a map of platform -> content ready to publish.
 * Platforms without a variant fall back to the default content.
 */
export function resolvePlatformContent(
  post: VariantSource,
  platforms: Iterable<string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of platforms) out[p] = contentForPlatform(post, p)
  return out
}

/**
 * True if any connected platform's effective content (variant or default) would
 * exceed that platform's character limit. Used to gate publish actions so a
 * long LinkedIn default doesn't block publishing when a short Twitter variant
 * already exists.
 */
export function anyPlatformOverLimit(
  post: VariantSource,
  platforms: Iterable<string>,
  xPremium: boolean
): boolean {
  for (const platform of platforms) {
    const text = contentForPlatform(post, platform)
    if (text.length > getContentLimit(platform, xPremium)) return true
  }
  return false
}

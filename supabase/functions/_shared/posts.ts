/**
 * Resolve the content string to use when publishing to a given platform.
 * Returns the per-platform variant if one exists, otherwise the default content.
 */
export function contentForPlatform(
  defaultContent: string,
  variants: Record<string, string> | null | undefined,
  platform: string,
): string {
  const variant = variants?.[platform]
  if (typeof variant === "string" && variant.length > 0) return variant
  return defaultContent
}

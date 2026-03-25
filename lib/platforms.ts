/** Canonical list of supported platform identifiers */
export const PLATFORM_IDS = ['twitter', 'linkedin', 'bluesky'] as const

export type PlatformId = (typeof PLATFORM_IDS)[number]

export interface PlatformConfig {
  label: string
  color: string
  description: string
}

/** Single source of truth for platform display config */
export const platformConfig: Record<string, PlatformConfig> = {
  twitter: {
    label: 'X',
    color: 'bg-zinc-800 text-zinc-300',
    description: 'Post build updates to your X timeline',
  },
  linkedin: {
    label: 'LinkedIn',
    color: 'bg-blue-500/10 text-blue-400',
    description: 'Share build updates with your professional network',
  },
  bluesky: {
    label: 'Bluesky',
    color: 'bg-sky-500/10 text-sky-400',
    description: 'Post build updates to the Bluesky network',
  },
}

/** Convenience lookup: platform id -> short label */
export const platformLabels: Record<string, string> = Object.fromEntries(
  Object.entries(platformConfig).map(([id, cfg]) => [id, cfg.label])
)

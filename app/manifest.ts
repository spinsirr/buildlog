import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BuildLog — Turn Shipping into Marketing',
    short_name: 'BuildLog',
    description:
      'Your team ships every day. BuildLog turns it into marketing. AI-powered posts for Twitter/X, LinkedIn, and Bluesky from your code changes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/logo-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

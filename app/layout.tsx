import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Mono, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['700'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
})

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFDF5' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://buildlog.ink'),
  title: {
    default: 'BuildLog — Turn Commits into Content',
    template: '%s | BuildLog',
  },
  description:
    'Connect your GitHub and let AI turn every commit into a ready-to-publish social post for Twitter/X, LinkedIn, and Bluesky. Build in public, effortlessly.',
  applicationName: 'BuildLog',
  authors: [{ name: 'BuildLog', url: 'https://buildlog.ink' }],
  creator: 'BuildLog',
  publisher: 'BuildLog',
  generator: 'Next.js',
  keywords: [
    'build in public',
    'developer tools',
    'github automation',
    'social media automation',
    'AI content generation',
    'twitter automation',
    'linkedin automation',
    'developer marketing',
    'commit to content',
  ],
  referrer: 'origin-when-cross-origin',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://buildlog.ink',
    siteName: 'BuildLog',
    title: 'BuildLog — Turn Commits into Content',
    description:
      'Connect GitHub once. AI writes the post. Publish to Twitter/X, LinkedIn, and Bluesky from one dashboard.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuildLog — Turn Commits into Content',
    description: 'Connect GitHub once. AI writes the post. Publish everywhere.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://kxhtfrmrvijxyvzstsdw.supabase.co" />
        <link rel="dns-prefetch" href="https://kxhtfrmrvijxyvzstsdw.supabase.co" />
      </head>
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" richColors closeButton />
      </body>
    </html>
  )
}

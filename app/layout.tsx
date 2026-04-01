import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, IBM_Plex_Mono, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  preload: false,
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-ibm-plex-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
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
    default: 'BuildLog — Turn Shipping into Marketing',
    template: '%s | BuildLog',
  },
  description:
    'Your team ships every day. BuildLog turns it into marketing. AI reads your code changes and writes platform-optimized posts for Twitter/X, LinkedIn, and Bluesky.',
  applicationName: 'BuildLog',
  authors: [{ name: 'BuildLog', url: 'https://buildlog.ink' }],
  creator: 'BuildLog',
  publisher: 'BuildLog',
  generator: 'Next.js',
  keywords: [
    'developer marketing',
    'go to market',
    'GTM for dev teams',
    'developer tools',
    'github automation',
    'social media automation',
    'AI content generation',
    'twitter automation',
    'linkedin automation',
    'shipping into marketing',
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
    title: 'BuildLog — Turn Shipping into Marketing',
    description:
      'Your team ships every day. BuildLog turns it into marketing — AI-written posts for Twitter/X, LinkedIn, and Bluesky.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuildLog — Turn Shipping into Marketing',
    description: 'Your team ships every day. BuildLog turns it into marketing.',
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
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
      </head>
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" richColors closeButton />
      </body>
    </html>
  )
}

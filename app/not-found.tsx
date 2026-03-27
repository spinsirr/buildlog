import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-neo-cream text-black">
      <main className="text-center max-w-lg">
        <div
          className="inline-flex border-2 border-black px-4 py-1.5 mb-8 -rotate-1 bg-neo-accent"
          style={{ boxShadow: '3px 3px 0 0 #000000' }}
        >
          <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
            404 Error
          </span>
        </div>

        <h1
          className="font-display font-black uppercase leading-tight mb-6"
          style={{ fontSize: 'clamp(48px, 10vw, 96px)' }}
        >
          Page not
          <br />
          <span
            className="inline-block border-4 border-black px-3 rotate-1 bg-neo-secondary"
            style={{ boxShadow: '6px 6px 0 0 #000000' }}
          >
            found
          </span>
        </h1>

        <p className="font-mono-ui text-sm md:text-base mb-10 leading-relaxed opacity-70">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 border-4 border-black px-8 py-4 bg-neo-lime font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          Back to home
        </Link>
      </main>
    </div>
  )
}

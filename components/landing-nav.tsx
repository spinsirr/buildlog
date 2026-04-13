import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { LogoMark } from '@/components/logo-mark'
import { MobileMenuButton } from '@/components/mobile-menu-button'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function LandingNav() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isLoggedIn = !!user

  return (
    <header className="border-b-4 border-black sticky top-0 z-50 bg-neo-cream">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <LogoMark size={32} />
          <span className="font-display font-bold text-xl tracking-tight">buildlog</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5" aria-label="Main navigation">
          <Link
            href="/examples"
            className="font-mono-ui text-sm font-bold uppercase tracking-widest px-2 py-1 border-2 border-transparent hover:border-black hover:bg-neo-secondary hover:px-3 hover:shadow-[4px_4px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Examples
          </Link>
          <Link
            href="/changelog"
            className="font-mono-ui text-sm font-bold uppercase tracking-widest px-2 py-1 border-2 border-transparent hover:border-black hover:bg-neo-lime hover:px-3 hover:shadow-[4px_4px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Changelogs
          </Link>
          <Link
            href="/pricing"
            className="font-mono-ui text-sm font-bold uppercase tracking-widest px-2 py-1 border-2 border-transparent hover:border-black hover:bg-neo-secondary hover:px-3 hover:shadow-[4px_4px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Pricing
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 border-4 border-black px-5 py-2 bg-neo-lime font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono-ui text-sm font-bold uppercase tracking-widest px-2 py-1 border-2 border-transparent hover:border-black hover:bg-neo-secondary hover:px-3 hover:shadow-[4px_4px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border-4 border-black px-5 py-2 bg-neo-accent font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </nav>

        {/* Mobile menu (client component for toggle state) */}
        <MobileMenuButton isLoggedIn={isLoggedIn} />
      </div>
    </header>
  )
}

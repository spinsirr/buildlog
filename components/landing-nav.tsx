'use client'

import { ArrowRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LogoMark } from '@/components/logo-mark'
import { createClient } from '@/lib/supabase/client'

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
    }
    checkAuth()
  }, [])

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

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="md:hidden border-4 border-black p-2 bg-neo-cream neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={3} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={3} />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden border-t-4 border-black px-6 py-6 flex flex-col gap-4 bg-neo-cream"
        >
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="block border-4 border-black px-5 py-4 bg-neo-secondary font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black neo-btn"
          >
            Pricing
          </Link>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block border-4 border-black px-5 py-4 bg-neo-lime font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black neo-btn"
            >
              Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block border-4 border-black px-5 py-4 bg-neo-cream font-mono-ui text-sm font-bold uppercase tracking-wider text-center neo-btn"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block border-4 border-black px-5 py-4 bg-neo-accent font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black neo-btn"
              >
                Get started →
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}

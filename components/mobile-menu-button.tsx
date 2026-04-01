'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export function MobileMenuButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
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

      {open && (
        <div
          id="mobile-menu"
          className="md:hidden absolute top-16 left-0 right-0 border-t-4 border-black px-6 py-6 flex flex-col gap-4 bg-neo-cream"
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
    </>
  )
}

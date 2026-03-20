'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard')
      } else {
        setLoading(false)
      }
    })
  }, [router])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#FFFDF5' }}
      >
        <div className="font-mono text-sm font-bold uppercase tracking-widest animate-pulse">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#FFFDF5' }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden
      />

      {/* Decorative floating badge — top left */}
      <div
        className="absolute top-10 left-8 hidden md:flex items-center gap-2 bg-neo-secondary border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest rotate-[-2deg]"
        style={{ boxShadow: '3px 3px 0 0 #000' }}
        aria-hidden
      >
        ★ BUILD IN PUBLIC
      </div>

      {/* Decorative floating badge — bottom right */}
      <div
        className="absolute bottom-10 right-8 hidden md:flex items-center gap-2 bg-neo-secondary border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest rotate-[2deg]"
        style={{ boxShadow: '3px 3px 0 0 #000', fontFamily: 'var(--font-ibm-plex-mono)' }}
        aria-hidden
      >
        SHIP CODE. GET NOTICED. ↗
      </div>

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 bg-white border-4 border-black neo-card"
      >
        {/* Card header strip */}
        <div className="bg-neo-accent border-b-4 border-black px-6 py-4 flex items-center justify-between">
          {/* Logo mark */}
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-0.5" aria-hidden>
              <div className="w-3 h-3 bg-black" />
              <div className="w-3 h-3 bg-neo-secondary" />
              <div className="w-3 h-3 bg-neo-secondary" />
              <div className="w-3 h-3 bg-black" />
            </div>
            <span
              className="font-display font-black text-xl uppercase tracking-tight"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              buildlog
            </span>
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
            v1.0
          </span>
        </div>

        {/* Card body */}
        <div className="px-6 py-8 flex flex-col gap-6">
          <div>
            <h1
              className="font-black text-3xl uppercase leading-none tracking-tight mb-2"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              <span className="inline-block bg-neo-lime border-2 border-black px-1 text-black">
                WELCOME
              </span><br />
              <span className="inline-block bg-neo-secondary border-2 border-black px-1 rotate-[-1deg] text-black">
                BACK.
              </span>
            </h1>
            <p
              className="font-mono text-sm text-black font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              Turn commits into content.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black" />

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'github',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
              }}
              className="w-full flex items-center justify-center gap-3 bg-black text-white border-4 border-black font-mono font-bold text-sm uppercase tracking-widest py-4 cursor-pointer neo-btn focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              <GitHubIcon />
              Continue with GitHub
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
              }}
              className="w-full flex items-center justify-center gap-3 bg-white text-black border-4 border-black font-mono font-bold text-sm uppercase tracking-widest py-4 cursor-pointer neo-btn focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'twitter',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
              }}
              className="w-full flex items-center justify-center gap-3 bg-zinc-700 text-white border-4 border-black font-mono font-bold text-sm uppercase tracking-widest py-4 cursor-pointer neo-btn focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              <XIcon />
              Continue with X
            </button>
          </div>

          <p
            className="text-center font-mono text-xs text-black font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
          >
            No password required
          </p>
        </div>

        {/* Card footer */}
        <div className="border-t-4 border-black px-6 py-3 bg-neo-muted/20 flex items-center justify-between">
          <span
            className="font-mono text-xs font-bold uppercase tracking-widest text-black"
            style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
          >
            buildlog.ink
          </span>
          <div className="flex gap-1" aria-hidden>
            <div className="w-2 h-2 rounded-full bg-neo-accent border border-black" />
            <div className="w-2 h-2 rounded-full bg-neo-secondary border border-black" />
            <div className="w-2 h-2 rounded-full bg-neo-lime border border-black" />
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

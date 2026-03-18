import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

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

      {/* Decorative lime badge — bottom right */}
      <div
        className="absolute bottom-12 right-8 hidden md:block bg-neo-lime border-2 border-black px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest rotate-[2deg]"
        style={{ boxShadow: '3px 3px 0 0 #000' }}
        aria-hidden
      >
        100% OPEN SOURCE
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
              WELCOME<br />
              <span className="inline-block bg-neo-secondary border-2 border-black px-1 rotate-[-1deg]">
                BACK.
              </span>
            </h1>
            <p
              className="font-mono text-sm text-black/60 font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              Turn commits into content.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black/10" />

          <form action="/api/auth/github" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-black text-white border-4 border-black font-mono font-bold text-sm uppercase tracking-widest py-4 cursor-pointer neo-btn focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
          </form>

          <p
            className="text-center font-mono text-xs text-black/40 font-bold uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
          >
            No password required
          </p>
        </div>

        {/* Card footer */}
        <div className="border-t-4 border-black px-6 py-3 bg-neo-muted/20 flex items-center justify-between">
          <span
            className="font-mono text-xs font-bold uppercase tracking-widest text-black/50"
            style={{ fontFamily: 'var(--font-ibm-plex-mono)' }}
          >
            Powered by Supabase
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

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current shrink-0" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

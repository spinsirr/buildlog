import { redirect } from 'next/navigation'
import {
  GitHubLoginButton,
  GoogleLoginButton,
  LinkedInLoginButton,
  XLoginButton,
} from '@/components/login-buttons'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-neo-cream">
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
        className="absolute top-10 left-8 hidden md:flex items-center gap-2 bg-neo-secondary border-2 border-black px-3 py-1.5 font-mono-ui text-xs font-bold uppercase tracking-widest rotate-[-2deg]"
        style={{ boxShadow: '3px 3px 0 0 #000' }}
        aria-hidden
      >
        ★ BUILD IN PUBLIC
      </div>

      {/* Decorative floating badge — bottom right */}
      <div
        className="absolute bottom-10 right-8 hidden md:flex items-center gap-2 bg-neo-secondary border-2 border-black px-3 py-1.5 font-mono-ui text-xs font-bold uppercase tracking-widest rotate-[2deg]"
        style={{ boxShadow: '3px 3px 0 0 #000' }}
        aria-hidden
      >
        SHIP CODE. GET NOTICED. ↗
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white border-4 border-black neo-card">
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
          <span className="font-mono-ui text-xs font-bold uppercase tracking-widest bg-black text-white px-2 py-0.5">
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
              </span>
              <br />
              <span className="inline-block bg-neo-secondary border-2 border-black px-1 rotate-[-1deg] text-black">
                BACK.
              </span>
            </h1>
            <p className="font-mono-ui text-sm text-black font-bold uppercase tracking-wide">
              Turn commits into content.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-black" />

          <div className="flex flex-col gap-3">
            <GitHubLoginButton />
            <GoogleLoginButton />
            <XLoginButton />
            <LinkedInLoginButton />
          </div>

          <p className="text-center font-mono-ui text-xs text-black font-bold uppercase tracking-wider">
            No password required
          </p>
        </div>

        {/* Card footer */}
        <div className="border-t-4 border-black px-6 py-3 bg-neo-muted/20 flex items-center justify-between">
          <span className="font-mono-ui text-xs font-bold uppercase tracking-widest text-black">
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

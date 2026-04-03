import { ArrowRight, Check, GitCommit, Globe, Star, Zap } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'

// ─── SEO Metadata ─────────────────────────────────────────────────────────────
const SITE_URL = 'https://buildlog.ink'

export const metadata: Metadata = {
  title: 'BuildLog — Turn Shipping into Marketing',
  description:
    'Your team ships every day. BuildLog turns it into marketing. AI reads your code changes and writes ready-to-publish posts — no writing needed.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'BuildLog',
    title: 'BuildLog — Turn Shipping into Marketing',
    description:
      'Your team ships every day. BuildLog turns it into marketing — AI-written posts from your code changes.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BuildLog — Turn Shipping into Marketing',
    description: 'Your team ships every day. BuildLog turns it into marketing.',
  },
}

// ─── JSON-LD Structured Data ──────────────────────────────────────────────────
// All data below is static constants — no user input, safe to inline via dangerouslySetInnerHTML
const JSON_LD_SOFTWARE_APP = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BuildLog',
  description:
    'Your team ships every day. BuildLog turns it into marketing. AI-powered social posts from your code changes — no writing needed.',
  url: SITE_URL,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free tier available',
  },
  featureList: [
    'GitHub integration',
    'AI-powered content generation',
    'Multi-platform publishing (Twitter/X, LinkedIn, Bluesky)',
    'Zero-effort developer content',
    'Code-aware AI — reads diffs, not just commit messages',
    'Auto-publish or review-first workflow',
  ],
})

const JSON_LD_ORGANIZATION = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BuildLog',
  url: SITE_URL,
  logo: `${SITE_URL}/logo-icon.png`,
  sameAs: ['https://buildlog.ink'],
  description:
    'BuildLog is the GTM engine for dev teams — AI turns every code change into ready-to-publish social posts.',
})

const JSON_LD_BREADCRUMB = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: SITE_URL,
    },
  ],
})

function JsonLd() {
  return (
    <>
      {/* eslint-disable-next-line -- static constants, no XSS risk */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD_SOFTWARE_APP }}
      />
      {/* eslint-disable-next-line -- static constants, no XSS risk */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD_ORGANIZATION }}
      />
      {/* eslint-disable-next-line -- static constants, no XSS risk */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD_BREADCRUMB }} />
    </>
  )
}

// ─── Marquee strip ────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  'Twitter · X',
  'LinkedIn',
  'Bluesky',
  'Ship → Post',
  'Code-Aware AI',
  'Zero Writing',
  'One Click Publish',
]

function MarqueeStrip() {
  return (
    <div className="border-y-4 border-black py-4 overflow-hidden bg-black" aria-hidden="true">
      <div className="flex w-max animate-marquee">
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span
            key={i}
            className={`font-mono-ui text-sm font-bold uppercase tracking-[0.2em] px-6 whitespace-nowrap ${i % 2 === 0 ? 'text-neo-lime' : 'text-neo-secondary'}`}
          >
            {item}
            <span className="mx-4 opacity-60">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Terminal demo ────────────────────────────────────────────────────────────
function TerminalDemo() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_80px_1fr] gap-4 lg:gap-6 items-start">
        {/* Commit terminal */}
        <article
          className="border-4 border-black neo-terminal bg-neo-dark"
          aria-label="Example: a git push triggers BuildLog"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b-4 border-black">
            <div
              className="w-3 h-3 rounded-full bg-neo-accent border-2 border-black"
              aria-hidden="true"
            />
            <div
              className="w-3 h-3 rounded-full bg-neo-secondary border-2 border-black"
              aria-hidden="true"
            />
            <div
              className="w-3 h-3 rounded-full bg-neo-mint border-2 border-black"
              aria-hidden="true"
            />
            <span className="ml-2 font-code text-xs text-neo-lime tracking-widest uppercase">
              terminal
            </span>
          </div>
          <div className="p-5 font-code text-sm space-y-2">
            <div className="flex gap-2">
              <span className="text-neo-secondary">$</span>
              <span className="text-neo-lime">
                git push <span className="text-white/60">origin main</span>
              </span>
            </div>
            <div className="text-neo-muted text-xs pl-5 opacity-80">
              feat: add team billing dashboard
            </div>
            <div className="text-neo-muted text-xs pl-5 opacity-80">
              4 files changed, 142 insertions(+), 18 deletions(-)
            </div>
            <div className="pt-2 flex items-center gap-2">
              <span className="text-neo-mint" aria-hidden="true">
                ✓
              </span>
              <span className="text-neo-lime opacity-80">buildlog analyzing diff...</span>
            </div>
          </div>
        </article>

        {/* Connector */}
        <div
          className="flex flex-row lg:flex-col items-center justify-center gap-3 py-4 lg:py-8"
          aria-hidden="true"
        >
          <div className="flex-1 lg:flex-none h-px lg:h-5 w-full lg:w-px bg-neo-lime" />
          <div
            className="border-2 border-neo-lime px-3 py-2 flex-shrink-0"
            style={{ boxShadow: '3px 3px 0 0 #BFFF00' }}
          >
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-neo-lime">
              AI ✦
            </span>
          </div>
          <div className="flex-1 lg:flex-none h-px lg:h-5 w-full lg:w-px bg-neo-lime" />
        </div>

        {/* Generated post */}
        <article
          className="border-4 border-black neo-terminal bg-neo-cream"
          aria-label="AI-generated post ready to publish anywhere"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b-4 border-black bg-neo-lime">
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black">
              Your post
            </span>
            <span className="font-mono-ui text-xs font-bold text-black/60">AI-generated</span>
          </div>
          <div className="p-5">
            <p className="font-mono-ui text-sm leading-relaxed text-black">
              Shipped team billing — every seat now has usage visibility and spend controls. Small
              feature, big trust signal for enterprise buyers.
              <br />
              <br />
              Why this matters: enterprise buyers don&apos;t just want a product that works — they
              need to justify the spend internally. Clear usage + cost visibility removes the
              biggest objection in procurement. #buildinpublic
            </p>
            <div className="flex items-center gap-4 pt-4 mt-4 border-t-2 border-black/10">
              <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black/40">
                Publish to
              </span>
              <div className="flex items-center gap-2">
                {(['Twitter / X', 'LinkedIn', 'Bluesky'] as const).map((platform) => (
                  <div
                    key={platform}
                    className="inline-flex border-2 border-black px-2.5 py-1 bg-neo-secondary"
                    style={{ boxShadow: '2px 2px 0 0 #000000' }}
                  >
                    <span className="font-mono-ui text-xs font-bold text-black">{platform}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

// ─── How it works steps ───────────────────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    Icon: GitCommit,
    iconLabel: 'Git commit icon',
    title: 'Connect your repos',
    desc: 'Install the GitHub App. BuildLog monitors pushes, merged PRs, and releases across all your repos.',
    accentClass: 'bg-neo-secondary',
  },
  {
    num: '02',
    Icon: Zap,
    iconLabel: 'Lightning bolt icon',
    title: 'AI reads the diff',
    desc: 'Not just commit messages — BuildLog reads your actual code changes and understands what you shipped.',
    accentClass: 'bg-neo-muted',
  },
  {
    num: '03',
    Icon: Globe,
    iconLabel: 'Globe icon',
    title: 'Publish everywhere',
    desc: 'One post, every platform. Publish to Twitter, LinkedIn, and Bluesky with a single click — or auto-publish on push.',
    accentClass: 'bg-neo-accent',
  },
]

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  {
    num: '0s',
    label: 'to write a post',
    sub: 'AI reads your diff and writes it',
    accentClass: 'bg-neo-accent',
  },
  {
    num: '3',
    label: 'platforms',
    sub: 'Twitter · LinkedIn · Bluesky',
    accentClass: 'bg-neo-secondary',
  },
  {
    num: '1',
    label: 'click to publish',
    sub: 'or zero — auto-publish on push',
    accentClass: 'bg-neo-muted',
  },
]

// ─── Grid overlay (reusable) ──────────────────────────────────────────────────
function GridOverlay({ opacity = '08' }: { opacity?: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(#000000${opacity} 1px, transparent 1px), linear-gradient(90deg, #000000${opacity} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <JsonLd />
      <LandingNav />

      <main id="main-content">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative py-24 md:py-32 px-6 overflow-hidden"
        >
          <GridOverlay />

          {/* Background ghost text */}
          <div
            className="absolute top-1/2 right-0 -translate-y-1/2 font-display font-black select-none pointer-events-none leading-none hidden lg:block"
            style={{
              fontSize: 'clamp(200px, 25vw, 320px)',
              color: 'transparent',
              WebkitTextStroke: '2px rgba(0,0,0,0.04)',
            }}
            aria-hidden="true"
          >
            ✦
          </div>

          <div className="max-w-5xl mx-auto relative">
            {/* Badge */}
            <div className="mb-8 md:mb-10">
              <div
                className="inline-flex border-2 border-black px-4 py-1.5 -rotate-1 bg-neo-secondary"
                style={{ boxShadow: '3px 3px 0 0 #000000' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                  ✦ Turn shipping into distribution
                </span>
              </div>
            </div>

            {/* Headline */}
            <h1
              id="hero-heading"
              className="font-display font-black uppercase tracking-tight leading-none mb-8"
              style={{ fontSize: 'clamp(44px, 8vw, 84px)' }}
            >
              <span className="block">You ship every day.</span>
              <span className="block">
                BuildLog turns it into{' '}
                <span
                  className="inline-block border-4 border-black px-3 rotate-1 bg-neo-accent"
                  style={{ boxShadow: '6px 6px 0 0 #000000' }}
                >
                  marketing
                </span>
              </span>
            </h1>

            {/* Subtext */}
            <p className="font-mono-ui text-base md:text-lg max-w-lg mb-10 leading-relaxed opacity-70">
              AI reads your actual code changes — not just commit messages — and writes
              ready-to-publish posts. No writing. No context-switching.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2.5 border-4 border-black px-8 py-4 bg-neo-accent font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              >
                Connect GitHub — free <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {/* Floating badges (desktop) */}
            <div
              className="absolute top-0 right-0 border-2 border-black px-3 py-2 rotate-3 hidden lg:block bg-neo-lime"
              style={{ boxShadow: '4px 4px 0 0 #000000' }}
              aria-hidden="true"
            >
              <div className="font-display font-black text-3xl leading-none">100%</div>
              <div className="font-mono-ui text-xs font-bold uppercase tracking-widest">
                code-aware
              </div>
            </div>

            {/* Spinning star */}
            <div className="absolute bottom-0 right-12 hidden lg:block" aria-hidden="true">
              <Star
                className="h-10 w-10 animate-spin-slow"
                fill="#FFD93D"
                stroke="#000000"
                strokeWidth={2}
              />
            </div>
          </div>
        </section>

        {/* ── MARQUEE ───────────────────────────────────────────────────────── */}
        <MarqueeStrip />

        {/* ── DEMO ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="demo-heading"
          className="border-y-4 border-black py-16 px-6 bg-neo-dark"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h2 id="demo-heading" className="sr-only">
                Live demo
              </h2>
              <div
                className="inline-flex border-2 border-neo-lime px-4 py-1.5 bg-neo-dark"
                style={{ boxShadow: '3px 3px 0 0 #BFFF00' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em] text-neo-lime">
                  ✦ See it in action
                </span>
              </div>
            </div>
            <TerminalDemo />
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section aria-labelledby="how-it-works-heading" className="py-24 px-6 bg-neo-cream">
          <div className="max-w-5xl mx-auto">
            <div className="mb-14">
              <div
                className="inline-flex border-2 border-black px-4 py-1.5 mb-6 -rotate-1 bg-neo-muted"
                style={{ boxShadow: '3px 3px 0 0 #000000' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                  How it works
                </span>
              </div>
              <h2
                id="how-it-works-heading"
                className="font-display font-black uppercase leading-tight"
                style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}
              >
                Three steps.
                <br />
                Zero friction.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 md:gap-8">
              {STEPS.map(({ num, Icon, iconLabel, title, desc, accentClass }) => (
                <article
                  key={num}
                  className="border-4 border-black p-8 bg-neo-cream neo-card relative overflow-hidden"
                >
                  {/* Watermark number */}
                  <div
                    className="absolute -bottom-4 -right-2 font-display font-black text-8xl leading-none select-none pointer-events-none opacity-[0.05]"
                    aria-hidden="true"
                  >
                    {num}
                  </div>

                  <div className="relative">
                    {/* Numbered badge */}
                    <div
                      className={`inline-flex border-2 border-black px-2.5 py-1 mb-5 rotate-1 font-mono-ui text-sm font-bold text-black ${accentClass}`}
                      style={{
                        boxShadow: '2px 2px 0 0 #000000',
                      }}
                    >
                      {num}
                    </div>

                    {/* Icon */}
                    <div className="mb-4">
                      <Icon
                        className="h-8 w-8"
                        strokeWidth={3}
                        stroke="#000000"
                        aria-label={iconLabel}
                      />
                    </div>

                    <h3 className="font-display font-bold text-xl mb-3 uppercase">{title}</h3>
                    <p className="font-mono-ui text-sm leading-relaxed opacity-70">{desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ─────────────────────────────────────────────────────────── */}
        <section aria-label="Key statistics" className="border-t-4 border-black bg-neo-cream">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3">
            {STATS.map(({ num, label, sub, accentClass }, i) => (
              <div
                key={num}
                className={`border-black p-10 md:p-14 ${accentClass} ${
                  i < 2 ? 'border-b-4 md:border-b-0 md:border-r-4' : ''
                }`}
              >
                <div
                  className="font-display font-black leading-none mb-3"
                  style={{ fontSize: 'clamp(56px, 8vw, 80px)' }}
                  aria-hidden="true"
                >
                  {num}
                </div>
                <div className="font-mono-ui text-sm font-bold uppercase tracking-wider mb-1">
                  {num} {label}
                </div>
                <div className="font-mono-ui text-xs opacity-60 uppercase tracking-wide">{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHY BUILDLOG ──────────────────────────────────────────────────── */}
        <section
          aria-labelledby="why-heading"
          className="border-t-4 border-black py-24 px-6 bg-neo-dark"
        >
          <div className="max-w-5xl mx-auto">
            <div className="mb-14">
              <div
                className="inline-flex border-2 border-neo-lime px-4 py-1.5 mb-6 rotate-1 bg-neo-dark"
                style={{ boxShadow: '3px 3px 0 0 #BFFF00' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em] text-neo-lime">
                  Why BuildLog
                </span>
              </div>
              <h2
                id="why-heading"
                className="font-display font-black uppercase leading-tight text-white"
                style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}
              >
                Your code changes are
                <br />
                your best content.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h3 className="font-display font-bold text-lg uppercase text-neo-lime">
                  Without BuildLog
                </h3>
                {[
                  'Ship a feature. Forget to post about it.',
                  'Open Twitter. Stare at blank compose box.',
                  'Write something. Delete it. Give up.',
                  'Copy-paste to LinkedIn. Forget Bluesky exists.',
                  'Post once a month. Wonder why nobody knows about your product.',
                ].map((item) => (
                  <div key={item} className="flex gap-3 items-start">
                    <span
                      className="text-neo-accent font-bold text-lg leading-none mt-0.5"
                      aria-hidden="true"
                    >
                      ✕
                    </span>
                    <p className="font-mono-ui text-sm leading-relaxed text-white/70">{item}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-6">
                <h3 className="font-display font-bold text-lg uppercase text-neo-lime">
                  With BuildLog
                </h3>
                {[
                  'Push to GitHub. BuildLog reads the diff.',
                  'AI writes the post — concise, human, no jargon.',
                  'One click → published to Twitter, LinkedIn, Bluesky.',
                  'Review in dashboard or auto-publish instantly.',
                  'Ship daily, post daily. Compound your distribution.',
                ].map((item) => (
                  <div key={item} className="flex gap-3 items-start">
                    <Check
                      className="h-4 w-4 text-neo-mint flex-shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="font-mono-ui text-sm leading-relaxed text-white/70">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          className="border-t-4 border-black py-24 px-6 relative overflow-hidden bg-neo-secondary"
        >
          <GridOverlay opacity="06" />

          {/* Decorative spinning star */}
          <div className="absolute top-8 left-8 hidden lg:block opacity-40" aria-hidden="true">
            <Star
              className="h-12 w-12 animate-spin-slow"
              fill="#000000"
              stroke="#000000"
              strokeWidth={1}
            />
          </div>
          <div className="absolute bottom-8 right-8 hidden lg:block opacity-30" aria-hidden="true">
            <Star
              className="h-8 w-8 animate-spin-slow"
              fill="#000000"
              stroke="#000000"
              strokeWidth={1}
            />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 mb-8 rotate-2 bg-neo-accent"
              style={{ boxShadow: '3px 3px 0 0 #000000' }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em] text-black">
                ✦ Free — 5 posts/month · 1 repo · 1 platform
              </span>
            </div>

            <h2
              id="cta-heading"
              className="font-display font-black uppercase leading-tight mb-6 text-black"
              style={{ fontSize: 'clamp(40px, 8vw, 80px)' }}
            >
              You ship.
              <br />
              AI writes
              <br />
              the post.
            </h2>

            <p className="font-mono-ui text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed opacity-70 text-black">
              Connect your GitHub in 30 seconds. Free tier gives you 5 posts/month with 1 repo and 1
              platform. Upgrade for unlimited.
            </p>

            <Link
              href="/login"
              className="inline-flex items-center gap-3 border-4 border-black px-10 py-5 bg-black font-mono-ui text-base font-bold uppercase tracking-wider text-white neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Connect GitHub — free <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black py-8 px-6 bg-neo-cream">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-display font-bold text-lg tracking-tight">buildlog</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Terms
            </Link>
            <span className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40">
              © {new Date().getFullYear()} buildlog
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

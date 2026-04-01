import { ArrowRight, Check, Star, X } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'

export const metadata: Metadata = {
  title: 'Pricing — BuildLog',
  description:
    "Free to start, upgrade when you need more. BuildLog turns your team's shipping activity into marketing — AI-powered posts for Twitter, LinkedIn, and Bluesky.",
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — BuildLog',
    description: 'Free to start, upgrade when you need more. Turn shipping into marketing.',
  },
  twitter: {
    card: 'summary',
    title: 'Pricing — BuildLog',
    description: 'Free to start, upgrade when you need more. Turn shipping into marketing.',
  },
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For solo devs getting started with build-in-public.',
    accent: 'bg-neo-secondary',
    cta: 'Get started — free',
    ctaStyle: 'bg-neo-cream',
    features: [
      { text: '5 posts per month', included: true },
      { text: '1 connected repo', included: true },
      { text: '1 platform (LinkedIn or Bluesky)', included: true },
      { text: 'AI post generation from diffs', included: true },
      { text: 'Public changelog page', included: true },
      { text: 'Unlimited repos', included: false },
      { text: 'Twitter + all platforms', included: false },
      { text: 'Auto-publish on push', included: false },
      { text: 'Brand voice training', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For founders and teams who ship fast and want to show it.',
    accent: 'bg-neo-accent',
    cta: 'Start 7-day free trial',
    ctaStyle: 'bg-neo-accent',
    popular: true,
    features: [
      { text: 'Unlimited posts', included: true },
      { text: 'Unlimited repos', included: true },
      { text: 'All platforms (Twitter, LinkedIn, Bluesky)', included: true },
      { text: 'AI post generation from diffs', included: true },
      { text: 'Public changelog page', included: true },
      { text: 'Auto-publish on push', included: true },
      { text: 'Platform-optimized content', included: true },
      { text: 'Weekly digest generation', included: true },
      { text: 'Priority support', included: true },
    ],
  },
  {
    name: 'Team',
    price: '$99',
    period: '/month',
    description: 'For dev teams turning shipping into a marketing engine.',
    accent: 'bg-neo-muted',
    cta: 'Coming soon',
    ctaStyle: 'bg-neo-muted',
    disabled: true,
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Up to 10 team members', included: true },
      { text: 'Shared post queue + approval flow', included: true },
      { text: 'Content calendar', included: true },
      { text: 'Brand voice training', included: true },
      { text: 'Team activity dashboard', included: true },
      { text: 'Release launch sequences', included: true },
      { text: 'Analytics & insights', included: true },
      { text: 'API access', included: true },
    ],
  },
]

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

export default function PricingPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <LandingNav />

      <main id="main-content">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="pricing-heading"
          className="relative py-20 md:py-28 px-6 overflow-hidden"
        >
          <GridOverlay />

          <div className="max-w-5xl mx-auto relative text-center">
            <div className="mb-8">
              <div
                className="inline-flex border-2 border-black px-4 py-1.5 -rotate-1 bg-neo-lime"
                style={{ boxShadow: '3px 3px 0 0 #000000' }}
              >
                <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                  ✦ Simple, honest pricing
                </span>
              </div>
            </div>

            <h1
              id="pricing-heading"
              className="font-display font-black uppercase tracking-tight leading-none mb-6"
              style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}
            >
              Free to ship.
              <br />
              <span
                className="inline-block border-4 border-black px-3 rotate-1 bg-neo-accent"
                style={{ boxShadow: '6px 6px 0 0 #000000' }}
              >
                Pay to scale.
              </span>
            </h1>

            <p className="font-mono-ui text-base md:text-lg max-w-lg mx-auto leading-relaxed opacity-70">
              Start free. Upgrade when your shipping outpaces 5 posts a month.
            </p>
          </div>
        </section>

        {/* ── PLANS ────────────────────────────────────────────────────────── */}
        <section aria-label="Pricing plans" className="border-t-4 border-black py-16 px-6 relative">
          <GridOverlay opacity="04" />

          <div className="max-w-5xl mx-auto relative">
            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={`border-4 border-black bg-neo-cream flex flex-col relative ${
                    plan.popular ? 'neo-card md:-translate-y-4' : 'neo-card'
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <div
                      className="absolute -top-4 left-1/2 -translate-x-1/2 border-2 border-black px-4 py-1 bg-neo-secondary rotate-2 z-10"
                      style={{ boxShadow: '3px 3px 0 0 #000000' }}
                    >
                      <span className="font-mono-ui text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        Most popular
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className={`px-6 py-5 border-b-4 border-black ${plan.accent}`}>
                    <h2 className="font-display font-black uppercase text-2xl tracking-tight text-black">
                      {plan.name}
                    </h2>
                  </div>

                  {/* Price */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="font-display font-black text-black"
                        style={{ fontSize: 'clamp(36px, 5vw, 48px)' }}
                      >
                        {plan.price}
                      </span>
                      <span className="font-mono-ui text-sm font-bold uppercase tracking-wider opacity-50">
                        {plan.period}
                      </span>
                    </div>
                    <p className="font-mono-ui text-sm leading-relaxed opacity-60 mt-2">
                      {plan.description}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="px-6 pb-6 flex-1">
                    <div className="border-t-2 border-black/10 pt-4 space-y-3">
                      {plan.features.map((f) => (
                        <div key={f.text} className="flex items-start gap-3">
                          {f.included ? (
                            <Check
                              className="h-4 w-4 text-black flex-shrink-0 mt-0.5"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          ) : (
                            <X
                              className="h-4 w-4 text-black/20 flex-shrink-0 mt-0.5"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`font-mono-ui text-sm ${f.included ? 'text-black' : 'text-black/30'}`}
                          >
                            {f.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    {plan.disabled ? (
                      <div
                        className={`border-4 border-black/30 px-5 py-3.5 ${plan.ctaStyle} font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black/40`}
                      >
                        {plan.cta}
                      </div>
                    ) : (
                      <Link
                        href="/login"
                        className={`block border-4 border-black px-5 py-3.5 ${plan.ctaStyle} font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2`}
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="faq-heading"
          className="border-t-4 border-black py-16 px-6 bg-neo-dark relative overflow-hidden"
        >
          <GridOverlay opacity="15" />

          <div className="max-w-3xl mx-auto relative">
            <div className="text-center mb-12">
              <h2
                id="faq-heading"
                className="font-display font-black uppercase text-3xl md:text-4xl tracking-tight text-white"
              >
                Questions?
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: 'What counts as a post?',
                  a: "Each AI-generated post that you publish (or auto-publish) to a platform counts as one post. Drafts that you never publish don't count.",
                },
                {
                  q: 'Can I switch platforms on the free plan?',
                  a: 'Yes. You get 1 connected platform (LinkedIn or Bluesky) at a time, but you can disconnect and reconnect a different one whenever you want. Twitter requires the Pro plan.',
                },
                {
                  q: 'What happens when I hit the free limit?',
                  a: "Your repos stay connected and BuildLog keeps generating drafts — you just can't publish until next month, or until you upgrade.",
                },
                {
                  q: 'Do you read my private code?',
                  a: 'BuildLog reads diffs (what changed) — not your full codebase. We never store your source code. Diffs are processed, used for generation, then discarded.',
                },
                {
                  q: 'When is the Team plan available?',
                  a: "Soon. If you're interested, start with Pro and we'll reach out when Teams launches with an exclusive early-access offer.",
                },
              ].map((faq) => (
                <details key={faq.q} className="border-4 border-white/20 bg-white/5 group">
                  <summary className="px-6 py-4 cursor-pointer font-mono-ui text-sm font-bold uppercase tracking-wider text-white flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <span
                      className="text-white/40 group-open:rotate-45 transition-transform duration-150 text-lg leading-none"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-6 pb-5">
                    <p className="font-mono-ui text-sm leading-relaxed text-white/60">{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="border-t-4 border-black py-20 px-6 relative overflow-hidden bg-neo-secondary">
          <GridOverlay opacity="06" />

          <div className="absolute top-8 right-8 hidden lg:block opacity-30" aria-hidden="true">
            <Star
              className="h-10 w-10 animate-spin-slow"
              fill="#000000"
              stroke="#000000"
              strokeWidth={1}
            />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <h2
              className="font-display font-black uppercase leading-tight mb-6 text-black"
              style={{ fontSize: 'clamp(36px, 7vw, 64px)' }}
            >
              Start shipping
              <br />
              your story.
            </h2>
            <p className="font-mono-ui text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed opacity-70 text-black">
              Connect GitHub in 30 seconds. Your first 5 posts are free every month.
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
          <span className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40">
            &copy; {new Date().getFullYear()} buildlog
          </span>
        </div>
      </footer>
    </div>
  )
}

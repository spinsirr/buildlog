import { ArrowRight, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ExampleCard, type ExampleData } from '@/components/example-card'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'

export const metadata: Metadata = {
  title: 'Examples — BuildLog',
  description:
    'See what BuildLog generates. Real examples of AI-powered posts from code changes — for Twitter, LinkedIn, and Bluesky.',
  alternates: { canonical: '/examples' },
  openGraph: {
    title: 'Examples — BuildLog',
    description: 'See what BuildLog generates from real code changes.',
  },
}

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

const EXAMPLES: ExampleData[] = [
  {
    type: 'commit',
    repo: 'saas-starter',
    stack: 'Next.js + Stripe + Supabase',
    trigger: {
      title: 'feat: add team billing dashboard with per-seat usage',
      detail: '4 files changed, 142 insertions(+), 18 deletions(-)',
    },
    posts: {
      twitter:
        'Shipped team billing — every seat now has usage visibility and spend controls. Small feature, big trust signal for enterprise buyers. #buildinpublic',
      linkedin:
        "We just shipped team billing with per-seat usage visibility.\n\nWhy this matters: enterprise buyers don't just want a product that works — they need to justify the spend internally. Giving every team member a clear view of their usage and costs removes the biggest objection in procurement conversations.\n\nSmall feature. Big unlock for sales.",
      bluesky:
        'Shipped team billing with per-seat usage visibility. Enterprise buyers need to justify spend — now every team member can see exactly what they use. Small feature, big trust signal.',
    },
    accent: 'bg-neo-secondary',
  },
  {
    type: 'pr',
    repo: 'cli-toolkit',
    stack: 'Rust CLI tool',
    trigger: {
      title: 'PR #47: Parallel file processing with rayon',
      detail: '3 files changed, 89 insertions(+), 34 deletions(-)',
    },
    posts: {
      twitter:
        'Just landed parallel file processing in cli-toolkit. Went from 12s to 0.8s on a 10k-file directory. Rayon makes this embarrassingly easy in Rust.',
      linkedin:
        "Merged a performance PR that changed one number: processing time went from 12 seconds to 0.8 seconds on 10,000 files.\n\nThe change was surprisingly simple — replaced sequential iteration with Rayon's parallel iterators. Three files changed. The hardest part was writing the benchmark to prove it worked.\n\nSometimes the best optimization isn't algorithmic — it's just using all your cores.",
      bluesky:
        'Landed parallel file processing — 12s down to 0.8s on 10k files. Rayon makes parallelism in Rust almost too easy. Three files changed.',
    },
    accent: 'bg-neo-muted',
  },
  {
    type: 'release',
    repo: 'openapi-gen',
    stack: 'TypeScript SDK generator',
    trigger: {
      title: 'v2.0.0 — Complete rewrite with Zod validation',
      detail: '28 files changed, 2,104 insertions(+), 1,847 deletions(-)',
    },
    posts: {
      twitter:
        'openapi-gen v2.0 is out. Full rewrite — now generates Zod schemas alongside TypeScript types. Runtime validation from your OpenAPI spec, zero config. Breaking changes in the README.',
      linkedin:
        "After 3 months of work, openapi-gen v2.0 is live.\n\nThe big change: generated SDKs now include Zod schemas for runtime validation, not just TypeScript types. Your OpenAPI spec becomes both compile-time AND runtime safety.\n\nWhat's new:\n• Zod schema generation from any OpenAPI 3.x spec\n• Tree-shaking friendly output\n• 40% smaller bundle than v1\n• Breaking: new config format (migration guide included)\n\nThis started as a weekend project and now has 200+ stars. Open source continues to surprise me.",
      bluesky:
        'openapi-gen v2.0 is live — full rewrite with Zod schema generation. Your OpenAPI spec now gives you compile-time AND runtime safety. 40% smaller bundles too.',
    },
    accent: 'bg-neo-accent',
  },
  {
    type: 'recap',
    repo: 'saas-starter',
    stack: 'Next.js + Stripe + Supabase',
    trigger: {
      title: 'Week of April 7 — 14 commits, 3 PRs merged, 1 release',
      detail: 'Auto-generated weekly recap from GitHub activity',
    },
    posts: {
      twitter:
        'Big week for saas-starter: shipped team billing, fixed Stripe webhook reliability, and released v1.2 with per-seat usage dashboards. Enterprise-ready just got real. #buildinpublic',
      linkedin:
        'Weekly shipping update for saas-starter:\n\nThis week we crossed a major milestone — the product is now enterprise-ready.\n\n• Team billing with per-seat usage tracking\n• Stripe webhook reliability overhaul (99.9% delivery rate)\n• v1.2 release with usage dashboards\n• 3 PRs merged, 14 commits across the week\n\nThe biggest unlock: procurement teams can now self-serve usage reports. That removes the #1 blocker in our sales pipeline.',
      bluesky:
        'Week in review for saas-starter: team billing shipped, Stripe webhooks overhauled, v1.2 released. 14 commits, 3 PRs merged. Enterprise-ready just got real.',
    },
    accent: 'bg-neo-secondary',
  },
  {
    type: 'branch',
    repo: 'saas-starter',
    stack: 'Next.js + Stripe + Supabase',
    trigger: {
      title: 'feat/team-billing — 8 commits, 1 PR merged',
      detail: 'Branch recap: summarize a feature branch before or after merge',
    },
    posts: {
      twitter:
        'Just merged the team billing branch — per-seat usage tracking, spend controls, and a billing dashboard. 8 commits, one feature that changes our enterprise story. #buildinpublic',
      linkedin:
        "Just merged feat/team-billing into main.\n\nWhat this branch delivered:\n• Per-seat usage tracking across the entire team\n• Spend controls with configurable alerts\n• A new billing dashboard for team admins\n\n8 commits over 4 days. The feature that makes us enterprise-ready.\n\nThe hardest part wasn't the code — it was getting the Stripe metered billing API to play nice with our usage aggregation. Lesson learned: always read the rate limiting docs first.",
      bluesky:
        'Merged feat/team-billing — per-seat usage tracking, spend controls, billing dashboard. 8 commits, 4 days. The feature that makes us enterprise-ready.',
    },
    accent: 'bg-neo-lime',
  },
  {
    type: 'commit',
    repo: 'design-system',
    stack: 'React + Storybook',
    trigger: {
      title: 'fix: color contrast ratio on secondary buttons (WCAG AA)',
      detail: '2 files changed, 8 insertions(+), 8 deletions(-)',
    },
    posts: {
      twitter:
        "Fixed: secondary buttons now pass WCAG AA contrast. 8 lines changed, 100% of users can read them. Accessibility isn't a feature — it's the baseline.",
      linkedin:
        "Pushed a small but important fix today: our secondary buttons weren't meeting WCAG AA contrast ratios.\n\n8 lines of CSS. That's all it took to go from 3.8:1 to 4.6:1 contrast ratio.\n\nAccessibility fixes are often this simple. The hard part isn't the code — it's noticing the problem in the first place. Automated tools catch the obvious stuff, but nothing beats testing with real users.",
      bluesky:
        'Fixed secondary button contrast to pass WCAG AA. 8 lines of CSS, 3.8:1 → 4.6:1 ratio. Accessibility is the baseline, not a feature.',
    },
    accent: 'bg-neo-lime',
  },
  {
    type: 'pr',
    repo: 'ai-chatbot',
    stack: 'Python + FastAPI + LangChain',
    trigger: {
      title: 'PR #112: Streaming responses with Server-Sent Events',
      detail: '6 files changed, 203 insertions(+), 67 deletions(-)',
    },
    posts: {
      twitter:
        'Added streaming to our AI chatbot. Response starts in <200ms instead of waiting 3-8s for the full answer. SSE + LangChain streaming callbacks. Night and day UX difference.',
      linkedin:
        "Just merged streaming responses into our AI chatbot and the UX improvement is dramatic.\n\nBefore: users stared at a spinner for 3-8 seconds waiting for GPT to finish thinking.\n\nAfter: first tokens appear in under 200ms. The response builds in real-time.\n\nThe implementation: Server-Sent Events on the backend, LangChain's streaming callbacks piped through FastAPI's StreamingResponse. The trickiest part was handling tool calls mid-stream — you need to buffer those and only stream the final text.\n\nIf your AI product doesn't stream yet, it should. Users don't mind waiting if they can see progress.",
      bluesky:
        'Added streaming to our AI chatbot — first tokens in <200ms instead of 3-8s wait. SSE + LangChain streaming callbacks. Night and day UX difference.',
    },
    accent: 'bg-neo-mint',
  },
]

export default function ExamplesPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <LandingNav />

      <main id="main-content">
        {/* -- HERO -- */}
        <section
          aria-labelledby="examples-heading"
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
                  See it in action
                </span>
              </div>
            </div>

            <h1
              id="examples-heading"
              className="font-display font-black uppercase tracking-tight leading-none mb-6"
              style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}
            >
              Real code.
              <br />
              <span
                className="inline-block border-4 border-black px-3 rotate-1 bg-neo-secondary"
                style={{ boxShadow: '6px 6px 0 0 #000000' }}
              >
                Real posts.
              </span>
            </h1>

            <p className="font-mono-ui text-base md:text-lg max-w-lg mx-auto leading-relaxed opacity-70">
              Every example below was generated by BuildLog from actual code changes, weekly recaps,
              and branch summaries. Different repos, different stacks, same workflow.
            </p>
          </div>
        </section>

        {/* -- EXAMPLES -- */}
        <section aria-label="Example posts" className="border-t-4 border-black py-16 px-6 relative">
          <GridOverlay opacity="04" />

          <div className="max-w-5xl mx-auto relative space-y-8">
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.trigger.title} example={example} />
            ))}
          </div>
        </section>

        {/* -- HOW IT WORKS -- */}
        <section className="border-t-4 border-black py-16 px-6 bg-neo-dark relative overflow-hidden">
          <GridOverlay opacity="15" />

          <div className="max-w-3xl mx-auto relative text-center">
            <h2 className="font-display font-black uppercase text-2xl md:text-3xl tracking-tight text-white mb-6">
              How it works
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { num: '1', text: 'Connect GitHub' },
                { num: '2', text: 'Push code' },
                { num: '3', text: 'Posts + recaps appear' },
              ].map((step) => (
                <div key={step.num} className="border-2 border-white/20 bg-white/5 p-4">
                  <div className="font-display font-black text-3xl text-neo-lime mb-1">
                    {step.num}
                  </div>
                  <div className="font-mono-ui text-xs font-bold uppercase tracking-wider text-white/60">
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
            <p className="font-mono-ui text-sm text-white/50 mb-8">
              BuildLog reads diffs, not commit messages. It understands what you actually shipped.
              Weekly recaps and branch summaries are generated from your GitHub activity.
            </p>
          </div>
        </section>

        {/* -- CTA -- */}
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
              Your turn.
            </h2>
            <p className="font-mono-ui text-sm md:text-base max-w-md mx-auto mb-10 leading-relaxed opacity-70 text-black">
              Connect your repo and see what BuildLog generates from your next push.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-3 border-4 border-black px-10 py-5 bg-black font-mono-ui text-base font-bold uppercase tracking-wider text-white neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Try it free <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* -- FOOTER -- */}
      <footer className="border-t-4 border-black py-8 px-6 bg-neo-cream">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-display font-bold text-lg tracking-tight">buildlog</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/changelog"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Changelogs
            </Link>
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
              &copy; {new Date().getFullYear()} buildlog
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

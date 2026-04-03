import { ArrowRight, GitCommit, GitMerge, Rocket, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
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

type Example = {
  type: 'commit' | 'pr' | 'release'
  repo: string
  stack: string
  trigger: { title: string; detail: string }
  twitter: string
  linkedin: string
  accent: string
}

const EXAMPLES: Example[] = [
  {
    type: 'commit',
    repo: 'saas-starter',
    stack: 'Next.js + Stripe + Supabase',
    trigger: {
      title: 'feat: add team billing dashboard with per-seat usage',
      detail: '4 files changed, 142 insertions(+), 18 deletions(-)',
    },
    twitter:
      'Shipped team billing — every seat now has usage visibility and spend controls. Small feature, big trust signal for enterprise buyers. #buildinpublic',
    linkedin:
      "We just shipped team billing with per-seat usage visibility.\n\nWhy this matters: enterprise buyers don't just want a product that works — they need to justify the spend internally. Giving every team member a clear view of their usage and costs removes the biggest objection in procurement conversations.\n\nSmall feature. Big unlock for sales.",
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
    twitter:
      'Just landed parallel file processing in cli-toolkit. Went from 12s to 0.8s on a 10k-file directory. Rayon makes this embarrassingly easy in Rust.',
    linkedin:
      "Merged a performance PR that changed one number: processing time went from 12 seconds to 0.8 seconds on 10,000 files.\n\nThe change was surprisingly simple — replaced sequential iteration with Rayon's parallel iterators. Three files changed. The hardest part was writing the benchmark to prove it worked.\n\nSometimes the best optimization isn't algorithmic — it's just using all your cores.",
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
    twitter:
      'openapi-gen v2.0 is out. Full rewrite — now generates Zod schemas alongside TypeScript types. Runtime validation from your OpenAPI spec, zero config. Breaking changes in the README.',
    linkedin:
      "After 3 months of work, openapi-gen v2.0 is live.\n\nThe big change: generated SDKs now include Zod schemas for runtime validation, not just TypeScript types. Your OpenAPI spec becomes both compile-time AND runtime safety.\n\nWhat's new:\n• Zod schema generation from any OpenAPI 3.x spec\n• Tree-shaking friendly output\n• 40% smaller bundle than v1\n• Breaking: new config format (migration guide included)\n\nThis started as a weekend project and now has 200+ stars. Open source continues to surprise me.",
    accent: 'bg-neo-accent',
  },
  {
    type: 'commit',
    repo: 'design-system',
    stack: 'React + Storybook',
    trigger: {
      title: 'fix: color contrast ratio on secondary buttons (WCAG AA)',
      detail: '2 files changed, 8 insertions(+), 8 deletions(-)',
    },
    twitter:
      'Fixed: secondary buttons now pass WCAG AA contrast. 8 lines changed, 100% of users can read them. Accessibility isn\'t a feature — it\'s the baseline.',
    linkedin:
      "Pushed a small but important fix today: our secondary buttons weren't meeting WCAG AA contrast ratios.\n\n8 lines of CSS. That's all it took to go from 3.8:1 to 4.6:1 contrast ratio.\n\nAccessibility fixes are often this simple. The hard part isn't the code — it's noticing the problem in the first place. Automated tools catch the obvious stuff, but nothing beats testing with real users.",
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
    twitter:
      'Added streaming to our AI chatbot. Response starts in <200ms instead of waiting 3-8s for the full answer. SSE + LangChain streaming callbacks. Night and day UX difference.',
    linkedin:
      "Just merged streaming responses into our AI chatbot and the UX improvement is dramatic.\n\nBefore: users stared at a spinner for 3-8 seconds waiting for GPT to finish thinking.\n\nAfter: first tokens appear in under 200ms. The response builds in real-time.\n\nThe implementation: Server-Sent Events on the backend, LangChain's streaming callbacks piped through FastAPI's StreamingResponse. The trickiest part was handling tool calls mid-stream — you need to buffer those and only stream the final text.\n\nIf your AI product doesn't stream yet, it should. Users don't mind waiting if they can see progress.",
    accent: 'bg-neo-mint',
  },
]

const TYPE_CONFIG = {
  commit: { Icon: GitCommit, label: 'Push' },
  pr: { Icon: GitMerge, label: 'PR Merged' },
  release: { Icon: Rocket, label: 'Release' },
}

function ExampleCard({ example }: { example: Example }) {
  const { Icon, label } = TYPE_CONFIG[example.type]

  return (
    <article className="border-4 border-black bg-neo-cream">
      {/* Header */}
      <div className={`px-6 py-4 border-b-4 border-black ${example.accent}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" strokeWidth={3} />
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider">{label}</span>
          </div>
          <span className="font-mono-ui text-xs font-bold uppercase tracking-wider opacity-60">
            {example.stack}
          </span>
        </div>
        <p className="font-code text-sm font-bold">{example.trigger.title}</p>
        <p className="font-code text-xs opacity-60 mt-1">{example.trigger.detail}</p>
      </div>

      {/* Generated posts */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-black/20">
        {/* Twitter */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="border-2 border-black px-2 py-0.5 bg-neo-secondary"
              style={{ boxShadow: '2px 2px 0 0 #000' }}
            >
              <span className="font-mono-ui text-[10px] font-bold uppercase tracking-wider">
                Twitter / X
              </span>
            </div>
          </div>
          <p className="font-mono-ui text-sm leading-relaxed">{example.twitter}</p>
        </div>

        {/* LinkedIn */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="border-2 border-black px-2 py-0.5 bg-[#0A66C2]"
              style={{ boxShadow: '2px 2px 0 0 #000' }}
            >
              <span className="font-mono-ui text-[10px] font-bold uppercase tracking-wider text-white">
                LinkedIn
              </span>
            </div>
          </div>
          <p className="font-mono-ui text-sm leading-relaxed whitespace-pre-line">
            {example.linkedin}
          </p>
        </div>
      </div>
    </article>
  )
}

export default function ExamplesPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <LandingNav />

      <main id="main-content">
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
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
                  ✦ See it in action
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
              Every example below was generated by BuildLog from actual code changes. Different
              repos, different stacks, same workflow.
            </p>
          </div>
        </section>

        {/* ── EXAMPLES ──────────────────────────────────────────────────────── */}
        <section
          aria-label="Example posts"
          className="border-t-4 border-black py-16 px-6 relative"
        >
          <GridOverlay opacity="04" />

          <div className="max-w-5xl mx-auto relative space-y-8">
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.trigger.title} example={example} />
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS (mini) ───────────────────────────────────────────── */}
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
                { num: '3', text: 'Posts appear' },
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
            </p>
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
              &copy; {new Date().getFullYear()} buildlog
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

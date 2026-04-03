import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'

export const metadata: Metadata = {
  title: 'Privacy Policy — BuildLog',
  description:
    'How BuildLog handles your data. We read diffs, not your codebase. No source code is stored.',
  alternates: { canonical: '/privacy' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-bold uppercase text-xl mb-4 tracking-tight">{title}</h2>
      <div className="font-mono-ui text-sm leading-relaxed opacity-80 space-y-3">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <LandingNav />

      <main id="main-content">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <div className="mb-4">
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 -rotate-1 bg-neo-muted"
              style={{ boxShadow: '3px 3px 0 0 #000000' }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                Legal
              </span>
            </div>
          </div>

          <h1
            className="font-display font-black uppercase tracking-tight leading-none mb-4"
            style={{ fontSize: 'clamp(36px, 6vw, 56px)' }}
          >
            Privacy Policy
          </h1>
          <p className="font-mono-ui text-sm opacity-50 mb-12">Last updated: April 2, 2026</p>

          <Section title="What we collect">
            <p>
              When you sign in with GitHub, we receive your GitHub username, email, and profile
              information. We also request access to your repositories through our GitHub App.
            </p>
            <p>
              When you connect a repo, BuildLog receives webhook events for pushes, pull requests,
              and releases. We process the <strong>diff</strong> (what changed) — not your full
              source code. We also read your README and manifest files (package.json, Cargo.toml,
              etc.) to understand project context.
            </p>
            <p>
              If you connect social platforms (Twitter/X, LinkedIn, Bluesky), we store OAuth tokens
              or credentials needed to publish on your behalf.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>
              <strong>Diffs</strong> are sent to our AI provider (Google Gemini) to generate social
              media posts. Diffs are processed in memory and not permanently stored after generation.
            </p>
            <p>
              <strong>Generated posts</strong> are stored in our database so you can review, edit,
              and publish them.
            </p>
            <p>
              <strong>Project context</strong> (README summary, tech stack) is stored to improve the
              quality of generated posts.
            </p>
            <p>
              We do not sell your data. We do not use your code or posts to train AI models.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>BuildLog uses the following services to operate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Supabase</strong> — authentication, database, serverless functions
              </li>
              <li>
                <strong>Google Gemini</strong> — AI content generation
              </li>
              <li>
                <strong>Stripe</strong> — payment processing
              </li>
              <li>
                <strong>Vercel</strong> — hosting
              </li>
              <li>
                <strong>GitHub</strong> — repository access and webhooks
              </li>
            </ul>
            <p>Each service has its own privacy policy and handles data per their terms.</p>
          </Section>

          <Section title="Data retention">
            <p>
              Your account data and generated posts are retained as long as your account is active.
              Diffs are processed transiently and not stored after post generation.
            </p>
            <p>
              When you disconnect a repo, we stop receiving webhooks. When you delete your account,
              we delete all associated data including posts, connected repos, and social tokens.
            </p>
          </Section>

          <Section title="Your rights">
            <p>You can at any time:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Disconnect any repo or social platform from your dashboard</li>
              <li>Delete individual posts</li>
              <li>Request full account deletion by contacting us</li>
              <li>Export your data by contacting us</li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>
              We use essential cookies for authentication (session management). We do not use
              tracking cookies or third-party analytics.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about this policy? Email us at{' '}
              <a
                href="mailto:support@buildlog.ink"
                className="underline underline-offset-2 hover:text-neo-accent"
              >
                support@buildlog.ink
              </a>{' '}
              or open an issue on{' '}
              <a
                href="https://github.com/buildlog-ink/buildlog"
                className="underline underline-offset-2 hover:text-neo-accent"
              >
                GitHub
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t-4 border-black py-8 px-6 bg-neo-cream">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-display font-bold text-lg tracking-tight">buildlog</span>
          </div>
          <div className="flex items-center gap-6">
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

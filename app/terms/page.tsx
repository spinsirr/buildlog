import type { Metadata } from 'next'
import Link from 'next/link'
import { LandingNav } from '@/components/landing-nav'
import { LogoMark } from '@/components/logo-mark'

export const metadata: Metadata = {
  title: 'Terms of Service — BuildLog',
  description: 'Terms of Service for BuildLog. Rules of the road for using our platform.',
  alternates: { canonical: '/terms' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display font-bold uppercase text-xl mb-4 tracking-tight">{title}</h2>
      <div className="font-mono-ui text-sm leading-relaxed opacity-80 space-y-3">{children}</div>
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen antialiased bg-neo-cream text-black">
      <LandingNav />

      <main id="main-content">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
          <div className="mb-4">
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 rotate-1 bg-neo-muted"
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
            Terms of Service
          </h1>
          <p className="font-mono-ui text-sm opacity-50 mb-12">Last updated: April 2, 2026</p>

          <Section title="The basics">
            <p>
              BuildLog (&ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a service that connects to
              your GitHub repositories and uses AI to generate social media posts from your code
              changes. By using BuildLog, you agree to these terms.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You sign in via GitHub OAuth. You&apos;re responsible for your account and anything
              that happens under it. Don&apos;t share your access or use BuildLog for someone
              else&apos;s repos without their permission.
            </p>
          </Section>

          <Section title="What you own">
            <p>
              Your code is yours. Your generated posts are yours. BuildLog doesn&apos;t claim
              ownership of any content you create or generate through our service. You grant us a
              limited license to process your diffs and project context solely for the purpose of
              generating posts.
            </p>
          </Section>

          <Section title="What we provide">
            <p>
              BuildLog generates social media posts using AI. The generated content is a starting
              point — you&apos;re responsible for reviewing and approving anything before it gets
              published to your social accounts. We don&apos;t guarantee the accuracy, tone, or
              appropriateness of AI-generated content.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>Don&apos;t use BuildLog to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Generate spam or misleading content</li>
              <li>Violate any platform&apos;s terms of service (Twitter, LinkedIn, Bluesky)</li>
              <li>Publish content that infringes on others&apos; rights</li>
              <li>Attempt to reverse-engineer or abuse our AI systems</li>
              <li>Automate actions that violate rate limits on connected platforms</li>
            </ul>
          </Section>

          <Section title="Billing">
            <p>
              Free accounts get 5 posts per month. Paid plans are billed monthly through Stripe. You
              can cancel anytime — your plan stays active until the end of the billing period.
              Refunds are handled case-by-case.
            </p>
          </Section>

          <Section title="Service availability">
            <p>
              We aim for high availability but don&apos;t guarantee 100% uptime. We may modify,
              suspend, or discontinue features with reasonable notice. We&apos;ll notify you of
              material changes via email or in-app notice.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              BuildLog is provided &ldquo;as is&rdquo;. We&apos;re not liable for any damages
              arising from your use of the service, including but not limited to: content published
              to your social accounts, loss of data, or service interruptions. Our total liability is
              limited to the amount you&apos;ve paid us in the last 12 months.
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You can delete your account at any time. We may terminate accounts that violate these
              terms. On termination, we delete your data as described in our{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-neo-accent">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update these terms. Material changes will be communicated via email. Continued
              use after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions?{' '}
              <a
                href="mailto:support@buildlog.ink"
                className="underline underline-offset-2 hover:text-neo-accent"
              >
                support@buildlog.ink
              </a>
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
              href="/privacy"
              className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-70"
            >
              Privacy
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

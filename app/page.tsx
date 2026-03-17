import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-5xl font-bold tracking-tight">buildlog</h1>
        <p className="text-xl text-muted-foreground max-w-md">
          Turn your commits into content. Connect GitHub, ship code, build in public — automatically.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className={cn(buttonVariants({ size: 'lg' }))}>Get started free</Link>
        <Link href="https://github.com" target="_blank" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>View demo</Link>
      </div>
      <div className="grid grid-cols-3 gap-6 max-w-2xl text-left mt-8">
        {[
          { title: 'Connect GitHub', desc: 'Link any repo with one click. We listen for pushes, PRs, and releases.' },
          { title: 'AI writes drafts', desc: 'Every meaningful event becomes a ready-to-post social media update.' },
          { title: 'Publish everywhere', desc: 'Review drafts and ship to Twitter/X, LinkedIn, and more.' },
        ].map(f => (
          <div key={f.title} className="flex flex-col gap-2 p-4 rounded-lg border">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  )
}

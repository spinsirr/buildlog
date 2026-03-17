import { Card, CardContent } from "@/components/ui/card";
import { GitBranch, Sparkles, Share2, Terminal } from "lucide-react";
import Link from "next/link";

function TerminalDemo() {
  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl shadow-purple-500/5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <span className="text-xs text-zinc-500 font-mono ml-2">terminal</span>
      </div>
      <div className="p-5 font-mono text-sm space-y-4">
        <div>
          <span className="text-zinc-500">$</span>{" "}
          <span className="text-zinc-300">git commit -m </span>
          <span className="text-emerald-400">
            &quot;feat: add dark mode toggle&quot;
          </span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <div className="animate-pulse">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <span className="text-zinc-400">BuildLog generating post...</span>
        </div>
        <div className="border-l-2 border-purple-500/40 pl-4 py-1 space-y-2">
          <p className="text-zinc-300">
            Just shipped dark mode for the app! Building features users actually
            ask for &gt; chasing trends.
          </p>
          <p className="text-zinc-500 text-xs">
            #buildinpublic #webdev #nextjs
          </p>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-xs">
          <span>&#10003;</span>
          <span>
            Draft ready &mdash; review &amp; publish from your dashboard
          </span>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: GitBranch,
    title: "Connect GitHub",
    description:
      "Link any repo with one click. We listen for pushes, PRs, and releases automatically.",
  },
  {
    icon: Sparkles,
    title: "AI Writes For You",
    description:
      "Every meaningful commit becomes a ready-to-post social media update, crafted by AI.",
  },
  {
    icon: Share2,
    title: "Publish Everywhere",
    description:
      "Review drafts and ship to Twitter/X, LinkedIn, and Bluesky from one dashboard.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Nav */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold text-lg tracking-tight">
            Build<span className="text-purple-400">Log</span>
          </span>
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-zinc-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-400 mb-2">
            <Terminal className="h-3 w-3" />
            <span>Build in public, effortlessly</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            Turn your commits
            <br />
            <span className="text-purple-400">into content</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Connect GitHub, ship code, and let AI generate social posts from
            your activity. Build in public without the effort.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-10 px-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Start building in public
            </Link>
            <Link
              href="https://github.com"
              target="_blank"
              className="inline-flex items-center justify-center h-10 px-6 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 text-sm font-medium transition-colors"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      {/* Terminal Demo */}
      <section className="px-6 pb-24">
        <TerminalDemo />
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800/50 py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-12 tracking-tight">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card
                key={feature.title}
                className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <CardContent className="pt-6 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="text-sm text-zinc-500 font-mono">
                    0{i + 1}
                  </div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/50 py-24 px-6">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to build in public?
          </h2>
          <p className="text-zinc-400">
            Connect your GitHub and start turning commits into content in under
            a minute.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-10 px-8 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-zinc-500">
          <span>BuildLog</span>
          <span>&copy; {new Date().getFullYear()} BuildLog. Open source.</span>
        </div>
      </footer>
    </div>
  );
}

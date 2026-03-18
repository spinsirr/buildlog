import Link from "next/link";
import { Github, ArrowRight, Star, GitCommit, Zap, Globe } from "lucide-react";
import { LandingNav } from "@/components/landing-nav";
import { createClient } from "@/lib/supabase/server";

// ─── Logo (used in footer) ────────────────────────────────────────────────────
function LogoMark({ size = 32 }: { size?: number }) {
  const cell = Math.round(size * 0.42);
  const start2 = size - cell;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden
    >
      <rect x="0" y="0" width={cell} height={cell} fill="#000000" />
      <rect x={start2} y="0" width={cell} height={cell} fill="#FF6B6B" />
      <rect x="0" y={start2} width={cell} height={cell} fill="#FFD93D" />
      <rect x={start2} y={start2} width={cell} height={cell} fill="#000000" />
    </svg>
  );
}

// ─── Marquee strip ────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "Twitter · X",
  "LinkedIn",
  "Bluesky",
  "Dev.to",
  "Hashnode",
  "Threads",
  "GitHub",
  "Build in Public",
  "Auto-Post",
  "Commit → Content",
  "No Writing Required",
];

function MarqueeStrip() {
  return (
    <div
      className="border-y-4 border-black py-4 overflow-hidden"
      style={{ background: "#000000" }}
      aria-hidden
    >
      <div className="flex w-max animate-marquee">
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span
            key={i}
            className="font-mono-ui text-sm font-bold uppercase tracking-[0.2em] px-6 whitespace-nowrap"
            style={{ color: i % 2 === 0 ? "#BFFF00" : "#FFD93D" }}
          >
            {item}
            <span className="mx-4 opacity-60">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Terminal demo ────────────────────────────────────────────────────────────
function TerminalDemo() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_1fr] gap-4 md:gap-6 items-center">
        {/* Commit terminal */}
        <div className="border-4 border-black neo-terminal bg-[#1A1A2E]">
          <div className="flex items-center gap-2 px-4 py-3 border-b-4 border-black">
            <div className="w-3 h-3 rounded-full bg-[#FF6B6B] border-2 border-black" />
            <div className="w-3 h-3 rounded-full bg-[#FFD93D] border-2 border-black" />
            <div className="w-3 h-3 rounded-full bg-[#A8E6CF] border-2 border-black" />
            <span className="ml-2 font-code text-xs text-[#BFFF00] tracking-widest uppercase">
              terminal
            </span>
          </div>
          <div className="p-5 font-code text-sm space-y-2">
            <div className="flex gap-2">
              <span className="text-[#FFD93D]">$</span>
              <span className="text-[#BFFF00]">
                git commit{" "}
                <span className="text-white/60">-m</span>{" "}
                <span className="text-white">&quot;feat: add dark mode&quot;</span>
              </span>
            </div>
            <div className="text-[#C4B5FD] text-xs pl-5 opacity-80">
              1 file changed, 24 insertions(+)
            </div>
            <div className="text-[#C4B5FD] text-xs pl-5 opacity-80">
              [main 3f8a1d2] feat: add dark mode
            </div>
            <div className="pt-2 flex items-center gap-2">
              <span className="text-[#A8E6CF]">✓</span>
              <span className="text-[#BFFF00] opacity-80">
                buildlog detected push
              </span>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-3">
          <div className="flex-1 md:flex-none h-px md:h-5 w-full md:w-px bg-[#BFFF00]" />
          <div
            className="border-2 border-[#BFFF00] px-3 py-2 flex-shrink-0"
            style={{ boxShadow: "3px 3px 0 0 #BFFF00" }}
          >
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-[#BFFF00]">
              AI ✦
            </span>
          </div>
          <div className="flex-1 md:flex-none h-px md:h-5 w-full md:w-px bg-[#BFFF00]" />
        </div>

        {/* Post output */}
        <div className="border-4 border-black neo-terminal bg-[#FFFDF5]">
          <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black bg-[#FFD93D]">
            <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black">
              Draft ready
            </span>
            <span className="font-mono-ui text-xs font-bold text-black">
              twitter · linkedin
            </span>
          </div>
          <div className="p-5 space-y-3">
            <p className="font-mono-ui text-sm leading-relaxed text-black">
              Just shipped dark mode 🌙
              <br />
              Building features people actually ask for &gt; chasing trends.
            </p>
            <div className="flex flex-wrap gap-2">
              {["#buildinpublic", "#webdev"].map((tag) => (
                <span
                  key={tag}
                  className="inline-block border-2 border-black px-2 py-0.5 rotate-1 font-mono-ui text-xs font-bold uppercase tracking-wider"
                  style={{
                    background: "#C4B5FD",
                    boxShadow: "2px 2px 0 0 #000000",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t-2 border-black">
              <div className="w-2.5 h-2.5 rounded-full bg-[#A8E6CF] border-2 border-black" />
              <span className="font-mono-ui text-xs font-bold uppercase tracking-wider text-black">
                Ready to publish
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── How it works steps ───────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    Icon: GitCommit,
    title: "Connect GitHub",
    desc: "Link any repo with one click. We monitor pushes, PRs, and releases automatically.",
    accent: "#FFD93D",
  },
  {
    num: "02",
    Icon: Zap,
    title: "AI writes the post",
    desc: "Every meaningful commit becomes a ready-to-publish social update, crafted by AI.",
    accent: "#C4B5FD",
  },
  {
    num: "03",
    Icon: Globe,
    title: "Publish everywhere",
    desc: "Review drafts and ship to Twitter/X, LinkedIn, Bluesky, Dev.to, Hashnode, and Threads from one dashboard.",
    accent: "#FF6B6B",
  },
];

// ─── Stats ────────────────────────────────────────────────────────────────────
const STATS = [
  {
    num: "0s",
    label: "to write a post",
    sub: "AI generates it instantly",
    accent: "#FF6B6B",
  },
  {
    num: "6",
    label: "platforms supported",
    sub: "Twitter · LinkedIn · Bluesky · More",
    accent: "#FFD93D",
  },
  {
    num: "∞",
    label: "posts per month",
    sub: "unlimited on all plans",
    accent: "#C4B5FD",
  },
];

// ─── Grid overlay (reusable) ──────────────────────────────────────────────────
function GridOverlay({ opacity = "08" }: { opacity?: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `linear-gradient(#000000${opacity} 1px, transparent 1px), linear-gradient(90deg, #000000${opacity} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: "#FFFDF5", color: "#000000" }}
    >
      <LandingNav isLoggedIn={!!user} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32 px-6 overflow-hidden">
        <GridOverlay />

        {/* Background ghost text */}
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 font-display font-black select-none pointer-events-none leading-none hidden lg:block"
          style={{
            fontSize: "clamp(200px, 25vw, 320px)",
            color: "transparent",
            WebkitTextStroke: "2px rgba(0,0,0,0.04)",
          }}
          aria-hidden
        >
          ✦
        </div>

        <div className="max-w-5xl mx-auto relative">
          {/* Badge */}
          <div className="mb-8 md:mb-10">
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 -rotate-1 bg-[#FFD93D]"
              style={{ boxShadow: "3px 3px 0 0 #000000" }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                ✦ Build in public, effortlessly
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1
            className="font-display font-black uppercase tracking-tight leading-none mb-8"
            style={{ fontSize: "clamp(52px, 10vw, 96px)" }}
          >
            <span className="block">Turn commits</span>
            <span className="block">
              into{" "}
              <span
                className="inline-block border-4 border-black px-3 rotate-1 bg-[#FF6B6B]"
                style={{ boxShadow: "6px 6px 0 0 #000000" }}
              >
                content
              </span>
            </span>
          </h1>

          {/* Subtext */}
          <p className="font-mono-ui text-base md:text-lg max-w-md mb-10 leading-relaxed opacity-70">
            Connect GitHub once. AI writes the post.
            <br />
            You review and publish everywhere.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2.5 border-4 border-black px-8 py-4 bg-[#FF6B6B] font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Start for free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 border-4 border-black px-8 py-4 bg-[#FFFDF5] font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              <Github className="h-4 w-4" /> View on GitHub
            </Link>
          </div>

          {/* Floating badges (desktop) */}
          <div
            className="absolute top-0 right-0 border-2 border-black px-3 py-2 rotate-3 hidden lg:block bg-[#BFFF00]"
            style={{ boxShadow: "4px 4px 0 0 #000000" }}
            aria-hidden
          >
            <div className="font-display font-black text-3xl leading-none">
              100%
            </div>
            <div className="font-mono-ui text-xs font-bold uppercase tracking-widest">
              automatic
            </div>
          </div>

          {/* Spinning star */}
          <div
            className="absolute bottom-0 right-12 hidden lg:block"
            aria-hidden
          >
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
      <section className="border-y-4 border-black py-16 px-6 bg-[#1A1A2E]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div
              className="inline-flex border-2 border-[#BFFF00] px-4 py-1.5 bg-[#1A1A2E]"
              style={{ boxShadow: "3px 3px 0 0 #BFFF00" }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em] text-[#BFFF00]">
                ✦ See it in action
              </span>
            </div>
          </div>
          <TerminalDemo />
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: "#FFFDF5" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <div
              className="inline-flex border-2 border-black px-4 py-1.5 mb-6 -rotate-1 bg-[#C4B5FD]"
              style={{ boxShadow: "3px 3px 0 0 #000000" }}
            >
              <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em]">
                How it works
              </span>
            </div>
            <h2
              className="font-display font-black uppercase leading-tight"
              style={{ fontSize: "clamp(36px, 6vw, 64px)" }}
            >
              Three steps.
              <br />
              Zero friction.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {STEPS.map(({ num, Icon, title, desc, accent }) => (
              <div
                key={num}
                className="border-4 border-black p-8 bg-[#FFFDF5] neo-card relative overflow-hidden"
              >
                {/* Watermark number */}
                <div
                  className="absolute -bottom-4 -right-2 font-display font-black text-8xl leading-none select-none pointer-events-none opacity-[0.05]"
                  aria-hidden
                >
                  {num}
                </div>

                <div className="relative">
                  {/* Numbered badge */}
                  <div
                    className="inline-flex border-2 border-black px-2.5 py-1 mb-5 rotate-1 font-mono-ui text-sm font-bold text-black"
                    style={{
                      background: accent,
                      boxShadow: "2px 2px 0 0 #000000",
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
                    />
                  </div>

                  <h3 className="font-display font-bold text-xl mb-3 uppercase">
                    {title}
                  </h3>
                  <p className="font-mono-ui text-sm leading-relaxed opacity-70">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────────────── */}
      <section className="border-t-4 border-black" style={{ background: "#FFFDF5" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3">
          {STATS.map(({ num, label, sub, accent }, i) => (
            <div
              key={num}
              className={`border-black p-10 md:p-14 ${
                i < 2 ? "border-b-4 md:border-b-0 md:border-r-4" : ""
              }`}
              style={{ background: accent }}
            >
              <div
                className="font-display font-black leading-none mb-3"
                style={{ fontSize: "clamp(56px, 8vw, 80px)" }}
              >
                {num}
              </div>
              <div className="font-mono-ui text-sm font-bold uppercase tracking-wider mb-1">
                {label}
              </div>
              <div className="font-mono-ui text-xs opacity-60 uppercase tracking-wide">
                {sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section
        className="border-t-4 border-black py-24 px-6 relative overflow-hidden"
        style={{ background: "#FFD93D" }}
      >
        <GridOverlay opacity="06" />

        {/* Decorative spinning star */}
        <div
          className="absolute top-8 left-8 hidden lg:block opacity-40"
          aria-hidden
        >
          <Star
            className="h-12 w-12 animate-spin-slow"
            fill="#000000"
            stroke="#000000"
            strokeWidth={1}
          />
        </div>
        <div
          className="absolute bottom-8 right-8 hidden lg:block opacity-30"
          aria-hidden
        >
          <Star
            className="h-8 w-8 animate-spin-slow"
            fill="#000000"
            stroke="#000000"
            strokeWidth={1}
          />
        </div>

        <div className="max-w-3xl mx-auto text-center relative">
          <div
            className="inline-flex border-2 border-black px-4 py-1.5 mb-8 rotate-2 bg-[#FF6B6B]"
            style={{ boxShadow: "3px 3px 0 0 #000000" }}
          >
            <span className="font-mono-ui text-xs font-bold uppercase tracking-[0.2em] text-black">
              ✦ Free to start
            </span>
          </div>

          <h2
            className="font-display font-black uppercase leading-tight mb-6 text-black"
            style={{ fontSize: "clamp(40px, 8vw, 80px)" }}
          >
            Ship code.
            <br />
            Let AI
            <br />
            tell the story.
          </h2>

          <p className="font-mono-ui text-sm md:text-base max-w-sm mx-auto mb-10 leading-relaxed opacity-70 text-black">
            Connect your GitHub and start turning commits into content in under
            a minute.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-3 border-4 border-black px-10 py-5 bg-black font-mono-ui text-base font-bold uppercase tracking-wider text-white neo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Connect GitHub for free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        className="border-t-4 border-black py-8 px-6"
        style={{ background: "#FFFDF5" }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span className="font-display font-bold text-lg tracking-tight">
              buildlog
            </span>
          </div>
          <span className="font-mono-ui text-xs font-bold uppercase tracking-widest opacity-40">
            © {new Date().getFullYear()} — Open Source
          </span>
        </div>
      </footer>
    </div>
  );
}

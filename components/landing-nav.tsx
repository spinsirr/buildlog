"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";

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

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="border-b-4 border-black sticky top-0 z-50"
      style={{ background: "#FFFDF5" }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <LogoMark size={32} />
          <span className="font-display font-bold text-xl tracking-tight">
            buildlog
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5" aria-label="Main navigation">
          <Link
            href="/login"
            className="font-mono-ui text-sm font-bold uppercase tracking-widest px-2 py-1 border-2 border-transparent hover:border-black hover:bg-[#FFD93D] hover:px-3 hover:shadow-[4px_4px_0_0_#000] transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 border-4 border-black px-5 py-2 bg-[#FF6B6B] font-mono-ui text-sm font-bold uppercase tracking-wider text-black neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden border-4 border-black p-2 neo-btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          style={{ background: "#FFFDF5" }}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={3} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={3} />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden border-t-4 border-black px-6 py-6 flex flex-col gap-4"
          style={{ background: "#FFFDF5" }}
        >
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block border-4 border-black px-5 py-4 font-mono-ui text-sm font-bold uppercase tracking-wider text-center neo-btn"
            style={{ background: "#FFFDF5" }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block border-4 border-black px-5 py-4 bg-[#FF6B6B] font-mono-ui text-sm font-bold uppercase tracking-wider text-center text-black neo-btn"
          >
            Get started →
          </Link>
        </div>
      )}
    </header>
  );
}

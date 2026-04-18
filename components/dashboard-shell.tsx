'use client'

import { useAuth } from '@/components/auth-provider'
import { DesktopSidebar } from '@/components/desktop-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { MobileSidebar } from '@/components/mobile-sidebar'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { userId, loading } = useAuth()

  if (loading || !userId) {
    return (
      <div className="min-h-screen bg-zinc-950" aria-busy="true">
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 md:flex animate-fade-slide-in font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-zinc-800 focus:text-zinc-50 focus:rounded-md focus:text-sm focus:ring-2 focus:ring-neo-accent"
      >
        Skip to content
      </a>
      <KeyboardShortcuts />
      <MobileSidebar />
      <DesktopSidebar />
      <div className="flex-1 md:ml-60">
        <main id="main-content" className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
